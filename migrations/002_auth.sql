-- Migration 002: Authentication & Account System (CUSTOMER & OWNER Roles)
-- Target Database: ev_charging_db

-- 1. Create table user_account
CREATE TABLE IF NOT EXISTS `user_account` (
  `User_ID` INT NOT NULL AUTO_INCREMENT,
  `Email` VARCHAR(100) NOT NULL,
  `Password_Hash` VARCHAR(255) NOT NULL,
  `Role` ENUM('CUSTOMER', 'OWNER') NOT NULL,
  `Customer_ID` INT NULL,
  `Owner_Name` VARCHAR(100) NULL,
  `Phone_Number` VARCHAR(15) NULL,
  `Created_At` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`User_ID`),
  UNIQUE KEY `idx_user_email` (`Email`),
  UNIQUE KEY `idx_user_customer` (`Customer_ID`),
  CONSTRAINT `fk_user_account_customer` FOREIGN KEY (`Customer_ID`) REFERENCES `customer` (`Customer_ID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Add Owner_User_ID column to charging_station if it doesn't already exist
SET @dbname = DATABASE();
SET @tablename = "charging_station";
SET @columnname = "Owner_User_ID";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE charging_station ADD COLUMN Owner_User_ID INT NULL, ADD CONSTRAINT fk_station_owner FOREIGN KEY (Owner_User_ID) REFERENCES user_account(User_ID) ON DELETE SET NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Seed demo accounts
-- Seed Demo Owner: Email: owner@demo.com, Password: Owner@123
INSERT INTO `user_account` (`User_ID`, `Email`, `Password_Hash`, `Role`, `Customer_ID`, `Owner_Name`, `Phone_Number`)
VALUES (1, 'owner@demo.com', '$2b$10$lecX/NL3DbjWexaUVoMC5uGZf/n/re2DIo.ezGFxM.WQcO2UHhsGK', 'OWNER', NULL, 'Rajesh Sharma', '9876543210')
ON DUPLICATE KEY UPDATE `Email` = VALUES(`Email`);

-- Seed Demo Customer linked to Customer_ID 1 (Rahul Sharma): Email: rahul@gmail.com, Password: Customer@123
INSERT INTO `user_account` (`User_ID`, `Email`, `Password_Hash`, `Role`, `Customer_ID`, `Owner_Name`, `Phone_Number`)
VALUES (2, 'rahul@gmail.com', '$2b$10$acBHgZfYqgNEqN8hB0/otuvkgb1j3CYONmBBoF442SzUnGuzDqtJS', 'CUSTOMER', 1, NULL, '9000000001')
ON DUPLICATE KEY UPDATE `Email` = VALUES(`Email`);

-- 4. Assign the 4 existing stations to the seeded demo owner account (User_ID 1)
UPDATE `charging_station` 
SET `Owner_User_ID` = 1 
WHERE `Station_ID` IN (1, 2, 3, 4) AND (`Owner_User_ID` IS NULL OR `Owner_User_ID` = 1);
