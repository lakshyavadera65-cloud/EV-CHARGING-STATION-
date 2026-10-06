-- MySQL dump 10.13  Distrib 8.0.39, for Win64 (x86_64)
--
-- Host: localhost    Database: ev_charging_db
-- ------------------------------------------------------
-- Server version	8.0.39

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `booking`
--

DROP TABLE IF EXISTS `booking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking` (
  `Booking_ID` int NOT NULL AUTO_INCREMENT,
  `Booking_Date` date NOT NULL,
  `Start_Time` time NOT NULL,
  `End_Time` time NOT NULL,
  `Booking_Status` varchar(30) DEFAULT 'Confirmed',
  `Customer_ID` int NOT NULL,
  `Charger_ID` int NOT NULL,
  PRIMARY KEY (`Booking_ID`),
  KEY `Customer_ID` (`Customer_ID`),
  KEY `Charger_ID` (`Charger_ID`),
  CONSTRAINT `booking_ibfk_1` FOREIGN KEY (`Customer_ID`) REFERENCES `customer` (`Customer_ID`),
  CONSTRAINT `booking_ibfk_2` FOREIGN KEY (`Charger_ID`) REFERENCES `charging_point` (`Charger_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking`
--

LOCK TABLES `booking` WRITE;
/*!40000 ALTER TABLE `booking` DISABLE KEYS */;
INSERT INTO `booking` VALUES (1,'2026-08-17','10:00:00','11:00:00','Confirmed',1,1),(2,'2026-08-17','11:30:00','12:30:00','Completed',2,2),(3,'2026-08-17','14:00:00','15:00:00','Confirmed',3,5),(4,'2026-08-18','09:00:00','10:00:00','Confirmed',4,6),(5,'2026-08-18','16:00:00','17:00:00','Cancelled',5,8),(6,'2026-08-19','12:00:00','13:00:00','Completed',6,10);
/*!40000 ALTER TABLE `booking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `charging_point`
--

DROP TABLE IF EXISTS `charging_point`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `charging_point` (
  `Charger_ID` int NOT NULL AUTO_INCREMENT,
  `Charger_Type` varchar(50) NOT NULL,
  `Connector_Type` varchar(50) NOT NULL,
  `Power_Output` decimal(10,2) DEFAULT NULL,
  `Availability_Status` varchar(30) DEFAULT NULL,
  `Station_ID` int NOT NULL,
  PRIMARY KEY (`Charger_ID`),
  KEY `Station_ID` (`Station_ID`),
  CONSTRAINT `charging_point_ibfk_1` FOREIGN KEY (`Station_ID`) REFERENCES `charging_station` (`Station_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `charging_point`
--

LOCK TABLES `charging_point` WRITE;
/*!40000 ALTER TABLE `charging_point` DISABLE KEYS */;
INSERT INTO `charging_point` VALUES (1,'DC Fast Charger','CCS2',60.00,'Occupied',1),(2,'AC Charger','Type 2',22.00,'Available',1),(3,'DC Fast Charger','CCS2',120.00,'Occupied',1),(4,'AC Charger','Type 2',22.00,'Maintenance',1),(5,'DC Fast Charger','CCS2',60.00,'Available',2),(6,'AC Charger','Type 2',11.00,'Available',2),(7,'DC Fast Charger','CHAdeMO',50.00,'Available',2),(8,'DC Fast Charger','CCS2',120.00,'Available',3),(9,'AC Charger','Type 2',22.00,'Occupied',3),(10,'DC Fast Charger','CCS2',60.00,'Available',3),(11,'AC Charger','Type 2',22.00,'Available',4),(12,'DC Fast Charger','CCS2',60.00,'Available',4);
/*!40000 ALTER TABLE `charging_point` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `charging_session`
--

DROP TABLE IF EXISTS `charging_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `charging_session` (
  `Session_ID` int NOT NULL AUTO_INCREMENT,
  `Session_Start` datetime NOT NULL,
  `Session_End` datetime DEFAULT NULL,
  `Energy_Consumed` decimal(10,2) DEFAULT NULL,
  `Charging_Cost` decimal(10,2) DEFAULT NULL,
  `Booking_ID` int NOT NULL,
  PRIMARY KEY (`Session_ID`),
  UNIQUE KEY `Booking_ID` (`Booking_ID`),
  CONSTRAINT `charging_session_ibfk_1` FOREIGN KEY (`Booking_ID`) REFERENCES `booking` (`Booking_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `charging_session`
--

LOCK TABLES `charging_session` WRITE;
/*!40000 ALTER TABLE `charging_session` DISABLE KEYS */;
INSERT INTO `charging_session` VALUES (1,'2026-08-17 10:05:00','2026-08-17 10:55:00',42.50,510.00,1),(2,'2026-08-17 11:35:00','2026-08-17 12:25:00',18.00,216.00,2),(3,'2026-08-17 14:05:00','2026-08-17 14:55:00',50.00,600.00,3),(4,'2026-08-18 09:05:00','2026-08-18 09:50:00',16.50,198.00,4),(5,'2026-08-19 12:05:00','2026-08-19 12:50:00',25.00,300.00,6);
/*!40000 ALTER TABLE `charging_session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `charging_station`
--

DROP TABLE IF EXISTS `charging_station`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `charging_station` (
  `Station_ID` int NOT NULL AUTO_INCREMENT,
  `Station_Name` varchar(100) NOT NULL,
  `Location` varchar(200) NOT NULL,
  `Contact_Number` varchar(15) DEFAULT NULL,
  `Total_Chargers` int DEFAULT NULL,
  `Operating_Hours` varchar(100) DEFAULT NULL,
  `Status` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`Station_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `charging_station`
--

LOCK TABLES `charging_station` WRITE;
/*!40000 ALTER TABLE `charging_station` DISABLE KEYS */;
INSERT INTO `charging_station` VALUES (1,'EV Hub Jaipur','Malviya Nagar, Jaipur','9876543210',10,'24 Hours','Active'),(2,'Green Charge Station','Vaishali Nagar, Jaipur','9876543211',8,'6 AM - 11 PM','Active'),(3,'Power EV Point','Mansarovar, Jaipur','9876543212',12,'24 Hours','Active'),(4,'ChargeGo Jaipur','Tonk Road, Jaipur','9876543213',6,'7 AM - 10 PM','Active');
/*!40000 ALTER TABLE `charging_station` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer`
--

DROP TABLE IF EXISTS `customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer` (
  `Customer_ID` int NOT NULL AUTO_INCREMENT,
  `Customer_Name` varchar(100) NOT NULL,
  `Phone_Number` varchar(15) DEFAULT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`Customer_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer`
--

LOCK TABLES `customer` WRITE;
/*!40000 ALTER TABLE `customer` DISABLE KEYS */;
INSERT INTO `customer` VALUES (1,'Rahul Sharma','9000000001','rahul@gmail.com','Jaipur'),(2,'Priya Verma','9000000002','priya@gmail.com','Jaipur'),(3,'Arjun Mehta','9000000003','arjun@gmail.com','Ajmer'),(4,'Sneha Kapoor','9000000004','sneha@gmail.com','Jaipur'),(5,'Rohan Singh','9000000005','rohan@gmail.com','Jaipur'),(6,'Ananya Gupta','9000000006','ananya@gmail.com','Jaipur');
/*!40000 ALTER TABLE `customer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee`
--

DROP TABLE IF EXISTS `employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee` (
  `Employee_ID` int NOT NULL AUTO_INCREMENT,
  `Employee_Name` varchar(100) NOT NULL,
  `Phone_Number` varchar(15) DEFAULT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `Designation` varchar(50) DEFAULT NULL,
  `Station_ID` int NOT NULL,
  PRIMARY KEY (`Employee_ID`),
  KEY `Station_ID` (`Station_ID`),
  CONSTRAINT `employee_ibfk_1` FOREIGN KEY (`Station_ID`) REFERENCES `charging_station` (`Station_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee`
--

LOCK TABLES `employee` WRITE;
/*!40000 ALTER TABLE `employee` DISABLE KEYS */;
INSERT INTO `employee` VALUES (1,'Amit Sharma','9876500011','amit@evhub.com','Technician',1),(2,'Rohit Verma','9876500012','rohit@evhub.com','Manager',1),(3,'Neha Singh','9876500013','neha@greencharge.com','Technician',2),(4,'Karan Mehta','9876500014','karan@greencharge.com','Supervisor',2),(5,'Priya Sharma','9876500015','priya@powerev.com','Technician',3),(6,'Arjun Gupta','9876500016','arjun@chargego.com','Technician',4);
/*!40000 ALTER TABLE `employee` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `maintenance`
--

DROP TABLE IF EXISTS `maintenance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `maintenance` (
  `Maintenance_ID` int NOT NULL AUTO_INCREMENT,
  `Maintenance_Date` date NOT NULL,
  `Description` varchar(255) DEFAULT NULL,
  `Status` varchar(30) DEFAULT NULL,
  `Cost` decimal(10,2) DEFAULT NULL,
  `Charger_ID` int NOT NULL,
  `Employee_ID` int NOT NULL,
  PRIMARY KEY (`Maintenance_ID`),
  KEY `Charger_ID` (`Charger_ID`),
  KEY `Employee_ID` (`Employee_ID`),
  CONSTRAINT `maintenance_ibfk_1` FOREIGN KEY (`Charger_ID`) REFERENCES `charging_point` (`Charger_ID`),
  CONSTRAINT `maintenance_ibfk_2` FOREIGN KEY (`Employee_ID`) REFERENCES `employee` (`Employee_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `maintenance`
--

LOCK TABLES `maintenance` WRITE;
/*!40000 ALTER TABLE `maintenance` DISABLE KEYS */;
INSERT INTO `maintenance` VALUES (1,'2026-08-15','Connector inspection and repair','Completed',1500.00,4,1),(2,'2026-08-16','Cable replacement','Completed',2200.00,7,3),(3,'2026-08-17','Cooling system check','In Progress',1000.00,9,5);
/*!40000 ALTER TABLE `maintenance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment`
--

DROP TABLE IF EXISTS `payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment` (
  `Payment_ID` int NOT NULL AUTO_INCREMENT,
  `Payment_Date` date NOT NULL,
  `Amount` decimal(10,2) NOT NULL,
  `Payment_Method` varchar(30) DEFAULT NULL,
  `Payment_Status` varchar(30) DEFAULT NULL,
  `Session_ID` int NOT NULL,
  PRIMARY KEY (`Payment_ID`),
  UNIQUE KEY `Session_ID` (`Session_ID`),
  CONSTRAINT `payment_ibfk_1` FOREIGN KEY (`Session_ID`) REFERENCES `charging_session` (`Session_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment`
--

LOCK TABLES `payment` WRITE;
/*!40000 ALTER TABLE `payment` DISABLE KEYS */;
INSERT INTO `payment` VALUES (1,'2026-08-17',510.00,'UPI','Paid',1),(2,'2026-08-17',216.00,'Card','Paid',2),(3,'2026-08-17',600.00,'UPI','Paid',3),(4,'2026-08-18',198.00,'Card','Paid',4),(5,'2026-08-19',300.00,'UPI','Paid',5);
/*!40000 ALTER TABLE `payment` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-06 19:33:15
