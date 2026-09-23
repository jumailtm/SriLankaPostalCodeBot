import { verifyPostcodeDatabase } from "../services/postcode/repository.js";

try {
  const verification = await verifyPostcodeDatabase();

  console.log("Postal Code Database Verification\n");
  console.log(`Total records: ${verification.totalRecords}`);
  console.log(`Postal-code database type: ${verification.postalCodeDataType}`);
  console.log(`Invalid postal codes: ${verification.invalidPostalCodes}`);
  console.log(`Missing names: ${verification.missingNames}`);
  console.log(`Duplicate logical records: ${verification.duplicateLogicalRecords}`);
  console.log(`Missing source URLs: ${verification.missingSourceUrls}`);
  console.log("\nOffice type distribution:");
  verification.officeTypeDistribution.forEach((entry) => {
    console.log(`${entry.officeType}: ${entry.count}`);
  });

  const hasQualityErrors =
    !["character varying", "text"].includes(verification.postalCodeDataType) ||
    verification.invalidPostalCodes > 0 ||
    verification.missingNames > 0 ||
    verification.duplicateLogicalRecords > 0 ||
    verification.missingSourceUrls > 0;
  if (hasQualityErrors) {
    console.error("\nDatabase verification found data-quality errors.");
    process.exitCode = 1;
  } else {
    console.log("\nDatabase verification passed.");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown verification error";
  console.error(`Postal-code database verification failed: ${message}`);
  process.exitCode = 1;
}
