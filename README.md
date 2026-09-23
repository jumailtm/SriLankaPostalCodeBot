# Sri Lanka Postal-Code Telegram Bot

An open-source TypeScript project for a Telegram bot that will help users find Sri Lankan postal-code information. Postal data comes only from official Department of Posts, Sri Lanka sources.

Phase 5 adds a reusable, read-only search service over the verified Neon PostgreSQL data. The project still does not implement Telegram commands, a search API, or message formatting.

## Technology

- Node.js 20 or newer and TypeScript
- grammY for the future Telegram bot
- Neon PostgreSQL with Drizzle ORM
- Zod and dotenv for configuration and validation
- PDF.js for extracting the official Postcode Directory
- Node's built-in test runner

## Project structure

```text
.
|-- data/
|   |-- raw/                          # Downloaded sources; ignored by Git
|   |-- postcodes.json                # Reviewable normalized dataset
|   |-- postcodes.csv                 # Spreadsheet-friendly dataset
|   |-- postcodes.meta.json           # Dataset-level source metadata
|   |-- postcodes.validation.json     # Validation and review report
|   `-- import-report.json            # Latest import and DB verification report
|-- drizzle/                          # Generated database migrations
|-- src/
|   |-- config/env.ts                 # Validated environment configuration
|   |-- db/                           # Neon connection and Drizzle schema
|   |-- scripts/                      # Import and verification commands
|   `-- services/
|       |-- postcode/                 # Collection, validation, and import pipeline
|       `-- search/
|           |-- classifier.ts         # Deterministic query classification
|           |-- formatter.ts          # Stable result formatting
|           |-- queries.ts            # Parameterized PostgreSQL queries
|           |-- search.ts             # Reusable search orchestration
|           |-- search.test.ts        # Database-free search tests
|           `-- types.ts              # Search request/response contracts
|-- .env.example
|-- drizzle.config.ts
|-- package.json
`-- tsconfig.json
```

## Install

```bash
npm install
```

For database commands, copy `.env.example` to `.env` and add your own Neon connection string. The postcode collector does not require database credentials.

## Collect the official postcode data

Run:

```bash
npm run postcode:collect
```

The command:

1. Downloads the official PDF and postcode search page.
2. Saves the unmodified downloads under the ignored `data/raw/` directory.
3. Extracts postcode and English office-label rows from the PDF.
4. Parses district and office-type abbreviations defined by the PDF legend.
5. Cross-checks the extracted rows against the official search page.
6. Normalizes whitespace and obvious unmatched-parenthesis extraction artifacts.
7. Validates every record and reports suspicious source values and possible duplicates.
8. Writes the review files under `data/`.

The collector fails clearly when a source cannot be downloaded, a source has an unexpected structure, the PDF cannot be parsed, or no records are extracted. It never substitutes fake data.

## Generated files

- `data/postcodes.json` contains clean records suitable for review before Phase 4.
- `data/postcodes.csv` contains the same records with null values represented by empty cells.
- `data/postcodes.meta.json` records collection time, parser version, official URLs, source roles, and SHA-256 hashes.
- `data/postcodes.validation.json` contains counts, invalid records, suspicious records, possible duplicate groups, missing-field counts, and PDF/search-page differences.
- `data/import-report.json` records the latest dry-run or real import summary without credentials.

Generated records contain only the current database fields:

```json
{
  "name": "...",
  "postalCode": ".....",
  "officeType": "Post Office",
  "district": null,
  "province": null,
  "address": null,
  "sourceUrl": "https://slpost.gov.lk/wp-content/uploads/2022/11/POST-CODE-BOOK-.pdf"
}
```

Postcodes remain strings so leading zeroes are preserved. No postal code is generated or corrected by the collector.

## Validation and review rules

- Office names must not be empty.
- Postcodes must contain exactly five ASCII digits.
- `(S)` is interpreted using the directory legend as `Sub Post Office`; unmarked alphabetical entries are represented as `Post Office`.
- Districts are populated only from abbreviations explicitly defined in the directory legend.
- Provinces are populated only when the row explicitly includes a province abbreviation defined by the legend.
- Addresses remain null because the alphabetical directory rows do not contain addresses.
- Duplicate-looking records are reported by normalized name, postcode, and office type; they are not silently removed.
- Raw office labels, PDF page numbers, and row numbers remain in validation findings for review.

## Parsing limitations

- The PDF has one name field in each of English, Sinhala, and Tamil. The current database schema has one name column, so this phase uses the English column and does not discard or rewrite the raw PDF.
- The separate Colombo-zone reference on PDF page 4 is image-only and is not part of the machine-readable alphabetical office list used for the dataset.
- The PDF legend defines `APR` for Ampara, while some source rows use the undefined abbreviation `AR`. Those records retain a null district and appear in the validation report instead of being guessed.
- The directory does not provide a distinct machine-readable marker that reliably identifies Receiving Post Offices. The pipeline does not invent one.
- Any disagreement between the official PDF and official search page is retained in the cross-source report for manual review.

## Tests

Run:

```bash
npm test
```

The tests cover collection validation, import behavior, and the required search scenarios including exact and partial searches, casing, whitespace, limits, district/province matching, Unicode, injection-like input, and empty queries. They use in-memory repositories and never connect to production Neon. Synthetic values are test fixtures only and never appear in the generated production dataset.

## Database commands

The Phase 2 database foundation remains available:

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:check
```

The collector never calls these commands and never inserts its dataset into Neon.

## Importing postal data

The importer reads `data/postcodes.json`; it does not scrape or download any website.

1. Configure `DATABASE_URL` in your ignored `.env` file.
2. Apply pending migrations, including the logical uniqueness index:

   ```bash
   npm run db:migrate
   ```

3. Preview the import without changing Neon:

   ```bash
   npm run postcode:import -- --dry-run
   ```

4. Review the calculated inserted, updated, unchanged, invalid, duplicate, and skipped counts.
5. Run the real import:

   ```bash
   npm run postcode:import
   ```

6. Query Neon directly to verify the stored data:

   ```bash
   npm run postcode:verify
   ```

Logical identity is the exact normalized combination of office name, postal code, and office type. Postal code alone is not unique. The same constraint is enforced by PostgreSQL.

Before writing, the importer reads existing offices in one query and calculates which rows are new, changed, or unchanged. New and changed records are sent in one atomic multi-row PostgreSQL upsert. Existing records not present in the dataset are never deleted. Running the same dataset again produces no duplicate rows and does not update unchanged timestamps.

The verification command reports total records, invalid postal-code formats, missing names, logical duplicates, missing source URLs, and office-type distribution using Neon queries rather than the JSON file.

## Postal-code search service

Import the reusable function from the search service:

```ts
import { searchPostalCode } from "./services/search/index.js";

const response = await searchPostalCode("Batticaloa");
```

The service supports:

- Exact five-digit postcode lookup
- Case-insensitive exact office-name lookup
- Office-name prefix and contains matching
- Explicit district searches such as `Batticaloa District`
- Explicit province searches such as `Western Province`
- Conservative whitespace and trailing-punctuation normalization
- Unicode-safe input and output
- Configurable result limits from 1 to 50, with a default of 10
- Database-backed suggestions containing only stored office names

Example response shape:

```json
{
  "query": "Batticaloa",
  "type": "office_name",
  "results": [
    {
      "id": "database-uuid",
      "name": "Batticaloa",
      "postalCode": "30000",
      "officeType": "Post Office",
      "district": "Batticaloa",
      "province": null,
      "address": null,
      "sourceUrl": "https://slpost.gov.lk/..."
    }
  ],
  "total": 1,
  "hasMore": false,
  "suggestions": [],
  "error": null
}
```

`total` is the number of returned records. `hasMore` indicates that the database returned another matching row beyond the requested limit.

Search ordering is deterministic:

1. Exact postcode
2. Exact office name
3. Office name starting with the query
4. Office name containing the query
5. District match
6. Province match

Exact names are queried first. Partial matching runs only when an exact office name is absent. Empty and malformed numeric queries return structured validation results without querying the database. All user values are passed as Drizzle parameters; SQL is never constructed by concatenating user input.

### Search performance

Filtering, ranking, ordering, and limiting happen in PostgreSQL. The service fetches at most `limit + 1` rows and never loads the complete table into Node.js.

The existing B-tree index supports exact postcode lookup. Case-insensitive contains searches do not efficiently use a normal B-tree index, but a sequential scan is reasonable for the current 2,111-row dataset. If the dataset grows substantially, consider PostgreSQL's `pg_trgm` extension with GIN indexes on searchable text columns after measuring real query performance; Phase 5 does not add those indexes prematurely.

## Source attribution

Data source: **Department of Posts, Sri Lanka / Sri Lanka Post**

- Official website: <https://slpost.gov.lk/>
- Official postcode search: <https://slpost.gov.lk/postcode_new/>
- Official Postcode Directory: <https://slpost.gov.lk/wp-content/uploads/2022/11/POST-CODE-BOOK-.pdf>

This project does not claim ownership of the official postal data. Each generated record retains the official PDF URL, and the dataset metadata retains both official source URLs and their hashes.

## Phase 6

Phase 6 will connect this search service to focused grammY Telegram handlers and format user-facing bot messages. It will not be implemented automatically.
