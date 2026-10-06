const http = require('http');

const API_BASE = 'http://localhost:3000/api';

async function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runScenario() {
  console.log('\n========================================================');
  console.log('🚀 RUNNING END-TO-END VERIFICATION OF EV CHARGING SYSTEM');
  console.log('========================================================\n');

  // STEP 1: Login as Owner
  console.log('1. Authenticating as Demo Owner (owner@demo.com)...');
  const loginRes = await fetchJson(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: { email: 'owner@demo.com', password: 'Owner@123' }
  });

  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error(`Owner login failed: ${JSON.stringify(loginRes.body)}`);
  }
  const token = loginRes.body.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('   ✅ Logged in successfully. Token acquired.\n');

  // STEP 2: Capture initial dashboard reports
  console.log('2. Fetching initial Dashboard KPI Reports from /api/reports/summary...');
  const initSummaryRes = await fetchJson(`${API_BASE}/reports/summary`, {
    headers: authHeaders
  });
  if (initSummaryRes.status !== 200) {
    throw new Error(`Failed to fetch summary: ${JSON.stringify(initSummaryRes.body)}`);
  }
  const initialRevenue = parseFloat(initSummaryRes.body.data.financials?.total_revenue || 0);
  const initialEnergy = parseFloat(initSummaryRes.body.data.sessions?.total_energy_kwh || 0);
  console.log(`   Initial Revenue: ₹ ${initialRevenue.toFixed(2)}`);
  console.log(`   Initial Delivered Energy: ${initialEnergy.toFixed(2)} kWh\n`);

  // STEP 3: Add a Customer
  console.log('3. Creating a new customer via POST /api/customers...');
  const uniqueSuffix = Date.now().toString().slice(-4);
  const newCustomerRes = await fetchJson(`${API_BASE}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      Customer_Name: `Arjun Tester ${uniqueSuffix}`,
      Phone_Number: `98290${uniqueSuffix}`,
      Email: `arjun_${uniqueSuffix}@test.com`,
      Address: 'Vaishali Nagar, Jaipur'
    }
  });

  if (newCustomerRes.status !== 201) {
    throw new Error(`Failed to create customer: ${JSON.stringify(newCustomerRes.body)}`);
  }
  const customerId = newCustomerRes.body.data.Customer_ID;
  console.log(`   ✅ Customer created: ID #${customerId} (${newCustomerRes.body.data.Customer_Name})\n`);

  // STEP 4: Choose an Available Charger
  console.log('4. Finding an Available Charger from /api/chargers...');
  const chargersRes = await fetchJson(`${API_BASE}/chargers?status=Available`, {
    headers: authHeaders
  });
  if (chargersRes.status !== 200 || !chargersRes.body.data.length) {
    throw new Error('No available chargers found to book!');
  }
  const charger = chargersRes.body.data[0];
  const chargerId = charger.Charger_ID;
  console.log(`   ✅ Selected Charger #${chargerId} (${charger.Charger_Type} at ${charger.Station_Name})\n`);

  // STEP 5: Validate Booking Time Constraints
  console.log('5. Testing Booking Validation:');
  const today = new Date().toISOString().split('T')[0];

  // 5a: Test Invalid Time: End_Time <= Start_Time
  console.log('   5a. Testing invalid slot (End_Time 10:00 <= Start_Time 11:00)...');
  const invalidTimeRes = await fetchJson(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      Customer_ID: customerId,
      Charger_ID: chargerId,
      Booking_Date: today,
      Start_Time: '11:00',
      End_Time: '10:00',
      Booking_Status: 'Confirmed'
    }
  });
  if (invalidTimeRes.status === 400) {
    console.log(`       ✅ Correctly rejected invalid slot: "${invalidTimeRes.body.error.message}"`);
  } else {
    throw new Error(`Expected 400 for invalid time, got ${invalidTimeRes.status}`);
  }

  // 5b: Create a valid booking
  console.log('   5b. Creating valid Confirmed booking for 14:00 - 15:00...');
  const validBookingRes = await fetchJson(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      Customer_ID: customerId,
      Charger_ID: chargerId,
      Booking_Date: today,
      Start_Time: '14:00',
      End_Time: '15:00',
      Booking_Status: 'Confirmed'
    }
  });
  if (validBookingRes.status !== 201) {
    throw new Error(`Failed to create booking: ${JSON.stringify(validBookingRes.body)}`);
  }
  const bookingId = validBookingRes.body.data.Booking_ID;
  console.log(`       ✅ Booking created: ID #${bookingId}\n`);

  // 5c: Test Overlapping Booking Conflict
  console.log('   5c. Testing overlapping slot conflict on same charger (14:30 - 15:30)...');
  const overlapRes = await fetchJson(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      Customer_ID: customerId,
      Charger_ID: chargerId,
      Booking_Date: today,
      Start_Time: '14:30',
      End_Time: '15:30',
      Booking_Status: 'Confirmed'
    }
  });
  if (overlapRes.status === 409) {
    console.log(`       ✅ Correctly rejected overlapping booking: "${overlapRes.body.error.message}"\n`);
  } else {
    throw new Error(`Expected 409 for overlapping booking, got ${overlapRes.status}`);
  }

  // STEP 6: Start Charging Session
  console.log(`6. Starting charging session for Booking #${bookingId} via POST /api/sessions/start...`);
  const startSessionRes = await fetchJson(`${API_BASE}/sessions/start`, {
    method: 'POST',
    headers: authHeaders,
    body: { Booking_ID: bookingId }
  });
  if (startSessionRes.status !== 201) {
    throw new Error(`Failed to start session: ${JSON.stringify(startSessionRes.body)}`);
  }
  const sessionId = startSessionRes.body.data.Session_ID;
  console.log(`   ✅ Session started: ID #${sessionId}`);

  // Check charger status is now Occupied
  const chargerCheckRes = await fetchJson(`${API_BASE}/chargers/${chargerId}`, {
    headers: authHeaders
  });
  if (chargerCheckRes.body.data.Availability_Status === 'Occupied') {
    console.log(`   ✅ Charger #${chargerId} status is now 'Occupied'.\n`);
  } else {
    throw new Error(`Expected charger status 'Occupied', found '${chargerCheckRes.body.data.Availability_Status}'`);
  }

  // STEP 7: End Charging Session with 20 kWh
  console.log(`7. Ending session #${sessionId} with 20.00 kWh consumed via POST /api/sessions/${sessionId}/end...`);
  const endSessionRes = await fetchJson(`${API_BASE}/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: authHeaders,
    body: { Energy_Consumed: 20.00 }
  });
  if (endSessionRes.status !== 200) {
    throw new Error(`Failed to end session: ${JSON.stringify(endSessionRes.body)}`);
  }
  const expectedCost = 20 * 12.0; // 240.00
  const actualCost = parseFloat(endSessionRes.body.data.Charging_Cost);
  console.log(`   ✅ Session ended.`);
  console.log(`   ✅ Calculated Cost: ₹ ${actualCost.toFixed(2)} (Expected: ₹ ${expectedCost.toFixed(2)})`);

  // Verify charger is restored to Available
  const chargerRestoredRes = await fetchJson(`${API_BASE}/chargers/${chargerId}`, {
    headers: authHeaders
  });
  if (chargerRestoredRes.body.data.Availability_Status === 'Available') {
    console.log(`   ✅ Charger #${chargerId} status is now restored to 'Available'.\n`);
  } else {
    throw new Error(`Expected charger status 'Available', found '${chargerRestoredRes.body.data.Availability_Status}'`);
  }

  // STEP 8: Pay for the Session via UPI
  console.log(`8. Processing UPI payment of ₹ ${actualCost.toFixed(2)} for Session #${sessionId}...`);
  const paymentRes = await fetchJson(`${API_BASE}/payments`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      Session_ID: sessionId,
      Payment_Method: 'UPI',
      Amount: actualCost,
      Payment_Status: 'Paid'
    }
  });
  if (paymentRes.status !== 201) {
    throw new Error(`Failed to process payment: ${JSON.stringify(paymentRes.body)}`);
  }
  const paymentId = paymentRes.body.data.Payment_ID;
  console.log(`   ✅ Payment recorded: PAY-#${paymentId}, Status: ${paymentRes.body.data.Payment_Status}, Method: ${paymentRes.body.data.Payment_Method}\n`);

  // STEP 9: Verify Dashboard Numbers Increased
  console.log('9. Verifying Dashboard KPI Numbers Update...');
  const updatedSummaryRes = await fetchJson(`${API_BASE}/reports/summary`, {
    headers: authHeaders
  });
  const updatedRevenue = parseFloat(updatedSummaryRes.body.data.financials?.total_revenue || 0);
  const updatedEnergy = parseFloat(updatedSummaryRes.body.data.sessions?.total_energy_kwh || 0);

  const revenueDelta = updatedRevenue - initialRevenue;
  const energyDelta = updatedEnergy - initialEnergy;

  console.log(`   New Revenue: ₹ ${updatedRevenue.toFixed(2)} (Δ +₹ ${revenueDelta.toFixed(2)})`);
  console.log(`   New Energy: ${updatedEnergy.toFixed(2)} kWh (Δ +${energyDelta.toFixed(2)} kWh)`);

  if (Math.abs(revenueDelta - 240.0) < 0.01 && Math.abs(energyDelta - 20.0) < 0.01) {
    console.log('   🎉 DASHBOARD KPI NUMBERS VERIFIED: Revenue increased by ₹240 and kWh increased by 20!\n');
  } else {
    throw new Error(`Dashboard delta mismatch: revenueDelta=${revenueDelta}, energyDelta=${energyDelta}`);
  }

  // STEP 10: Test Maintenance Workflow
  console.log('10. Testing Maintenance Workflow:');
  const employeesRes = await fetchJson(`${API_BASE}/employees`, { headers: authHeaders });
  const employeeId = employeesRes.body.data[0].Employee_ID;

  console.log(`    Logging In Progress maintenance on Charger #${chargerId}...`);
  const createMaintRes = await fetchJson(`${API_BASE}/maintenance`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      Charger_ID: chargerId,
      Employee_ID: employeeId,
      Status: 'In Progress',
      Cost: 450.00,
      Description: 'Routine socket contact test'
    }
  });
  if (createMaintRes.status !== 201) {
    throw new Error(`Failed to log maintenance: ${JSON.stringify(createMaintRes.body)}`);
  }
  const maintId = createMaintRes.body.data.Maintenance_ID;

  // Verify charger is now Maintenance
  const chargerMaintRes = await fetchJson(`${API_BASE}/chargers/${chargerId}`, { headers: authHeaders });
  if (chargerMaintRes.body.data.Availability_Status === 'Maintenance') {
    console.log(`    ✅ Charger #${chargerId} set to 'Maintenance'.`);
  } else {
    throw new Error(`Expected 'Maintenance', got '${chargerMaintRes.body.data.Availability_Status}'`);
  }

  // Verify booking this charger while under maintenance is rejected
  console.log(`    Verifying booking Charger #${chargerId} is rejected while under maintenance...`);
  const maintBookingRes = await fetchJson(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      Customer_ID: customerId,
      Charger_ID: chargerId,
      Booking_Date: today,
      Start_Time: '17:00',
      End_Time: '18:00',
      Booking_Status: 'Confirmed'
    }
  });
  if (maintBookingRes.status === 400) {
    console.log(`    ✅ Correctly rejected booking charger under maintenance: "${maintBookingRes.body.error.message}"`);
  } else {
    throw new Error(`Expected 400 for booking charger under maintenance, got ${maintBookingRes.status}`);
  }

  // Complete maintenance
  console.log(`    Completing maintenance #${maintId}...`);
  const completeMaintRes = await fetchJson(`${API_BASE}/maintenance/${maintId}/complete`, {
    method: 'PATCH',
    headers: authHeaders,
    body: { Cost: 450.00 }
  });
  if (completeMaintRes.status !== 200) {
    throw new Error(`Failed to complete maintenance: ${JSON.stringify(completeMaintRes.body)}`);
  }

  // Verify charger is restored to Available
  const chargerPostMaintRes = await fetchJson(`${API_BASE}/chargers/${chargerId}`, { headers: authHeaders });
  if (chargerPostMaintRes.body.data.Availability_Status === 'Available') {
    console.log(`    ✅ Charger #${chargerId} restored to 'Available'.\n`);
  } else {
    throw new Error(`Expected 'Available', got '${chargerPostMaintRes.body.data.Availability_Status}'`);
  }

  // STEP 11: Test Account Registration (Customer & Owner)
  console.log('11. Testing Account Creation (Create Account flow):');
  const regEmailCust = `driver_${Date.now()}@test.com`;
  const regCustRes = await fetchJson(`${API_BASE}/auth/register/customer`, {
    method: 'POST',
    body: {
      name: 'Rohan New Driver',
      email: regEmailCust,
      phone: '9829988776',
      address: 'Raja Park, Jaipur',
      password: 'SecurePassword123'
    }
  });
  if (regCustRes.status === 201 && regCustRes.body.user.role === 'CUSTOMER') {
    console.log(`    ✅ Customer registration succeeded for ${regEmailCust} (Role: CUSTOMER).`);
  } else {
    throw new Error(`Customer registration failed: ${JSON.stringify(regCustRes.body)}`);
  }

  const regEmailOwner = `owner_${Date.now()}@test.com`;
  const regOwnerRes = await fetchJson(`${API_BASE}/auth/register/owner`, {
    method: 'POST',
    body: {
      name: 'Supercharge Jaipur Ltd',
      email: regEmailOwner,
      phone: '9829911223',
      password: 'SecurePassword123'
    }
  });
  if (regOwnerRes.status === 201 && regOwnerRes.body.user.role === 'OWNER') {
    console.log(`    ✅ Owner registration succeeded for ${regEmailOwner} (Role: OWNER).\n`);
  } else {
    throw new Error(`Owner registration failed: ${JSON.stringify(regOwnerRes.body)}`);
  }

  console.log('========================================================');
  console.log('🎉 ALL END-TO-END SCENARIO TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('========================================================\n');
}

runScenario().catch(err => {
  console.error('\n❌ Scenario Test Failed:', err);
  process.exit(1);
});
