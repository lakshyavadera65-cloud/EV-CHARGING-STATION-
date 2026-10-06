const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING AUTH & AUTHORIZATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      if (details) console.error('   Details:', details);
      failed++;
    }
  }

  try {
    // Test 0: Public Endpoints (Unauthenticated)
    const publicStations = await request('GET', '/api/stations');
    assert(publicStations.status === 200, 'Unauthenticated user can view stations (200)', publicStations);

    const publicChargers = await request('GET', '/api/chargers');
    assert(publicChargers.status === 200, 'Unauthenticated user can view chargers (200)', publicChargers);

    const publicHealth = await request('GET', '/api/health');
    assert(publicHealth.status === 200, 'Unauthenticated user can view /api/health (200)', publicHealth);

    const unauthReports = await request('GET', '/api/reports/summary');
    assert(unauthReports.status === 401, 'Unauthenticated user is denied /api/reports/summary (401)', unauthReports);

    const unauthBookings = await request('GET', '/api/bookings');
    assert(unauthBookings.status === 401, 'Unauthenticated user is denied /api/bookings (401)', unauthBookings);

    // Test 1: Customer Register
    const randomSuffix = Date.now();
    const custPayload = {
      name: 'Rohan Tester',
      email: `rohan_${randomSuffix}@test.com`,
      phone: '9876599999',
      address: 'Jaipur Tech Park',
      password: 'CustomerPassword@123'
    };

    const custReg = await request('POST', '/api/auth/register/customer', custPayload);
    assert(
      custReg.status === 201 && custReg.body.token && custReg.body.user.role === 'CUSTOMER',
      'Customer register returns 201, token, and role CUSTOMER',
      custReg
    );
    const customerToken = custReg.body?.token;
    const customerId = custReg.body?.user?.customer_id;

    // Test 2: Owner Register
    const owner1Payload = {
      name: 'Owner Alpha',
      email: `owner_alpha_${randomSuffix}@test.com`,
      phone: '9876588888',
      password: 'OwnerPassword@123'
    };
    const owner1Reg = await request('POST', '/api/auth/register/owner', owner1Payload);
    assert(
      owner1Reg.status === 201 && owner1Reg.body.token && owner1Reg.body.user.role === 'OWNER',
      'Owner 1 register returns 201, token, and role OWNER',
      owner1Reg
    );
    const owner1Token = owner1Reg.body?.token;
    const owner1UserId = owner1Reg.body?.user?.id;

    // Second Owner to test cross-owner isolation
    const owner2Payload = {
      name: 'Owner Beta',
      email: `owner_beta_${randomSuffix}@test.com`,
      phone: '9876577777',
      password: 'OwnerPassword@123'
    };
    const owner2Reg = await request('POST', '/api/auth/register/owner', owner2Payload);
    assert(owner2Reg.status === 201, 'Owner 2 register returns 201', owner2Reg);
    const owner2Token = owner2Reg.body?.token;

    // Test 3: Login (both Customer and Owner)
    const custLogin = await request('POST', '/api/auth/login', {
      email: custPayload.email,
      password: custPayload.password
    });
    assert(
      custLogin.status === 200 && custLogin.body.user.role === 'CUSTOMER' && custLogin.body.token,
      'Customer login succeeds (200) with valid token and user profile',
      custLogin
    );

    const ownerLogin = await request('POST', '/api/auth/login', {
      email: owner1Payload.email,
      password: owner1Payload.password
    });
    assert(
      ownerLogin.status === 200 && ownerLogin.body.user.role === 'OWNER',
      'Owner login succeeds (200) with valid token',
      ownerLogin
    );

    const badLogin = await request('POST', '/api/auth/login', {
      email: custPayload.email,
      password: 'WrongPassword@123'
    });
    assert(badLogin.status === 401, 'Login with invalid password returns 401', badLogin);

    // Test GET /api/auth/me
    const meCust = await request('GET', '/api/auth/me', null, customerToken);
    assert(meCust.status === 200 && meCust.body.user.role === 'CUSTOMER', 'GET /api/auth/me returns customer profile', meCust);

    const meOwner = await request('GET', '/api/auth/me', null, owner1Token);
    assert(meOwner.status === 200 && meOwner.body.user.role === 'OWNER', 'GET /api/auth/me returns owner profile', meOwner);

    // Test 4: A customer trying an owner-only route (expect 403)
    // 4a. Customer trying to create a station
    const custCreateStation = await request('POST', '/api/stations', {
      Station_Name: 'Hacked Station',
      Location: 'Nowhere'
    }, customerToken);
    assert(custCreateStation.status === 403, 'Customer trying to POST /api/stations returns 403', custCreateStation);

    // 4b. Customer trying to access reports
    const custReports = await request('GET', '/api/reports/summary', null, customerToken);
    assert(custReports.status === 403, 'Customer trying to GET /api/reports/summary returns 403', custReports);

    // 4c. Customer trying to manage employees
    const custEmployees = await request('GET', '/api/employees', null, customerToken);
    assert(custEmployees.status === 403, 'Customer trying to GET /api/employees returns 403', custEmployees);

    // 4d. Customer trying to manage maintenance
    const custMaintenance = await request('GET', '/api/maintenance', null, customerToken);
    assert(custMaintenance.status === 403, 'Customer trying to GET /api/maintenance returns 403', custMaintenance);

    // Test 5: An owner editing someone else's station (expect 403)
    // First, Owner 1 creates Station A
    const owner1StationRes = await request('POST', '/api/stations', {
      Station_Name: `Station Alpha ${randomSuffix}`,
      Location: 'Jaipur North',
      Operating_Hours: '24 Hours'
    }, owner1Token);
    assert(owner1StationRes.status === 201, 'Owner 1 creates Station Alpha (201)', owner1StationRes);
    const station1Id = owner1StationRes.body?.data?.Station_ID;

    // Owner 2 tries to edit Station A (owned by Owner 1)
    const owner2EditStation1 = await request('PUT', `/api/stations/${station1Id}`, {
      Station_Name: 'Owner 2 Hijacked Station'
    }, owner2Token);
    assert(
      owner2EditStation1.status === 403,
      'Owner 2 editing Owner 1 station returns 403 Forbidden',
      owner2EditStation1
    );

    // Owner 2 tries to delete Station A
    const owner2DeleteStation1 = await request('DELETE', `/api/stations/${station1Id}`, null, owner2Token);
    assert(
      owner2DeleteStation1.status === 403,
      'Owner 2 deleting Owner 1 station returns 403 Forbidden',
      owner2DeleteStation1
    );

    // Owner 1 CAN edit their own station
    const owner1EditOwn = await request('PUT', `/api/stations/${station1Id}`, {
      Station_Name: `Station Alpha Updated ${randomSuffix}`
    }, owner1Token);
    assert(owner1EditOwn.status === 200, 'Owner 1 can edit their own station (200)', owner1EditOwn);

    // Owner 2 tries to add a charger to Owner 1's station
    const owner2AddCharger = await request('POST', '/api/chargers', {
      Charger_Type: 'DC Fast Charger',
      Connector_Type: 'CCS2',
      Power_Output: 60.00,
      Station_ID: station1Id
    }, owner2Token);
    assert(
      owner2AddCharger.status === 403,
      'Owner 2 adding charger to Owner 1 station returns 403 Forbidden',
      owner2AddCharger
    );

    // Owner 1 CAN add a charger to their station
    const owner1AddCharger = await request('POST', '/api/chargers', {
      Charger_Type: 'DC Fast Charger',
      Connector_Type: 'CCS2',
      Power_Output: 60.00,
      Station_ID: station1Id
    }, owner1Token);
    assert(owner1AddCharger.status === 201, 'Owner 1 can add charger to their own station (201)', owner1AddCharger);
    const chargerId = owner1AddCharger.body?.data?.Charger_ID;

    // Test Customer Booking only for themselves
    // Customer books charger for themselves
    const validBooking = await request('POST', '/api/bookings', {
      Booking_Date: '2026-12-01',
      Start_Time: '10:00:00',
      End_Time: '11:00:00',
      Customer_ID: customerId,
      Charger_ID: chargerId
    }, customerToken);
    assert(validBooking.status === 201, 'Customer can book charger for themselves (201)', validBooking);
    const bookingId = validBooking.body?.data?.Booking_ID;

    // Customer tries to book for someone else (Customer_ID: 999)
    const spoofBooking = await request('POST', '/api/bookings', {
      Booking_Date: '2026-12-01',
      Start_Time: '12:00:00',
      End_Time: '13:00:00',
      Customer_ID: 999,
      Charger_ID: chargerId
    }, customerToken);
    assert(spoofBooking.status === 403, 'Customer trying to book for another Customer_ID returns 403', spoofBooking);

    // Test Seeded Demo Logins
    const demoOwnerLogin = await request('POST', '/api/auth/login', {
      email: 'owner@demo.com',
      password: 'Owner@123'
    });
    assert(demoOwnerLogin.status === 200 && demoOwnerLogin.body.user.role === 'OWNER', 'Demo owner login works (200)', demoOwnerLogin);

    const demoCustLogin = await request('POST', '/api/auth/login', {
      email: 'rahul@gmail.com',
      password: 'Customer@123'
    });
    assert(demoCustLogin.status === 200 && demoCustLogin.body.user.role === 'CUSTOMER', 'Demo customer login works (200)', demoCustLogin);

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  }

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  }
}

runTests();
