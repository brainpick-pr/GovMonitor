# Tender Data Integration Study - South India

## Objective

Evaluate feasibility of fetching live tender data for 5 South Indian states into GovMonitor.

## Target States & Portals

| State | Portal | URL | Platform |
|-------|--------|-----|----------|
| Tamil Nadu | TN eProcurement | tntenders.gov.in | NIC GEP |
| Kerala | Kerala eProcurement | etenders.kerala.gov.in | NIC GEP |
| Karnataka | Karnataka eProcurement | eproc.karnataka.gov.in | Custom JSP |
| Andhra Pradesh | AP eProcurement | tender.apeprocurement.gov.in | Custom |
| Telangana | Telangana eProcurement | tender.telangana.gov.in | Custom |

## Direct Scraping Assessment

### NIC GEP Platform (Tamil Nadu, Kerala)

- Homepage redirects to `/nicgep/app`
- Active tenders page: `/nicgep/app?page=FrontEndLatestActiveTenders&service=page`
- **Blocker: CAPTCHA required** to view tender listings
- Search also requires CAPTCHA
- No public JSON/REST API exposed
- Available pages (all CAPTCHA-gated):
  - Active Tenders
  - Tenders by Closing Date
  - Tenders by Location
  - Tenders by Organisation
  - Tenders by Classification
  - Tenders in Archive

### Karnataka (Custom JSP)

- Redirects to `/eprocportal/pages/index.jsp`
- Tender list at: `/eprocurement/common/eproc_tenders_list.seam`
- **Blocker: Session + form POST required**
- Search form requires Category, Sub-Category, District, Department, Status filters
- No public API
- Has 500+ registered departments

### Andhra Pradesh & Telangana (Custom)

- Both use CSRF token + session-based login flow
- **Blocker: CSRF token + POST login required** before any data access
- JavaScript-heavy login redirect on page load
- No public API

### Central CPPP (eprocure.gov.in)

- Search page at `/cppp/tendersearch/cpppdata` requires CAPTCHA
- **Two endpoints work without CAPTCHA:**
  - `/cppp/latestactivetendersnew` - 10 latest tenders (all India, no state filter)
  - `/cppp/tendersclosingbydays/bytoday` - tenders closing today
- Data fields available: Published Date, Closing Date, Opening Date, Title/ID, Organisation
- **Limitation:** Only central govt tenders, no state-level filtering, max 10 results

### Summary: Direct Scraping

| Portal | Scrapable? | Blocker |
|--------|-----------|---------|
| TN (NIC GEP) | No | CAPTCHA |
| Kerala (NIC GEP) | No | CAPTCHA |
| Karnataka | No | Session + form POST |
| Andhra Pradesh | No | CSRF + session login |
| Telangana | No | CSRF + session login |
| CPPP (central) | Partial | 10 results only, no state filter |

**Verdict:** Direct scraping from a Cloudflare Worker is not feasible for state-level tender data.

---

## Paid API Providers

### 1. BidAssist (Recommended)

- **Website:** https://bidassist.com
- **API Docs:** https://api-doc.bidassist.com
- **Coverage:** 80,000+ sources, 45+ extracted fields per tender using NLP/ML
- **Authentication:** `x-api-key` header
- **Rate Limit:** 5 requests/second per API key
- **Endpoints:**
  - Search tenders by filters (state, status, category, etc.)
  - Bid awards / tender results
  - Feed source filtering (mandatory `FEED_SOURCE_ID`)
- **Response:** JSON with pagination
- **Pricing:**
  - Basic: Rs 499 (limited)
  - Standard: Rs 3,000/year (50 keywords, 300 downloads/month)
  - Enterprise API: Contact sales (contact@bidassist.com / 1800 102 9586)
  - Pay-per-tender: Rs 299/tender
  - Free trial: 3 days
- **Pros:** Most mature API, structured JSON, large dataset, ML-processed fields
- **Cons:** Enterprise API pricing not public, rate limited to 5 req/sec

### 2. TendersOnTime

- **Website:** https://www.tendersontime.com
- **API Docs:** https://www.tendersontime.com/tenders/api_documentation
- **Base URL:** `https://tmproject.tendersontime.org/tmpApi/tender-pull-json-tot.php`
- **Authentication:** username + API key (query params)
- **Endpoints:**
  - Retrieve tenders by date: `?username=X&key=Y&date=YYYY-MM-DD&page=1&perpage=10`
- **Response Format:**
  ```json
  {
    "status": "success",
    "posting_date": "YYYY-MM-DD",
    "pagination": { "total_items": 100, "per_page": 10 },
    "data": [...]
  }
  ```
- **Pricing:**
  - 1 State: Rs 2,500/year + GST (1 account)
  - 5 States: Rs 5,000/year + GST (2 accounts)
  - All India: Rs 9,000/year + GST (3 accounts)
  - Bulk/Enterprise: Contact for XML Feed, API, or server transfer
- **Pros:** Affordable, documented REST API, state-level filtering
- **Cons:** Simple date-based retrieval, limited query flexibility

### 3. Tender247

- **Website:** https://www.tender247.com
- **Coverage:** 100,000+ businesses, state-wise search, bid management
- **API:** No public API documented
- **Pricing:** Contact for enterprise plans
- **Pros:** Large user base, bid management tools
- **Cons:** No API access for integration

### 4. TenderShark

- **Website:** https://www.tendershark.com
- **Coverage:** All India, state-wise, authority-wise (PWD, NHAI, etc.)
- **API:** No public API
- **Pricing:** Not publicly listed
- **Cons:** Web-only, no programmatic access

### 5. TenderDetail

- **Website:** https://www.tenderdetail.com
- **Coverage:** AI-driven tender search, all India
- **API:** No public API
- **Pricing:** Not publicly listed
- **Cons:** Web-only, no programmatic access

---

## Comparison Matrix

| Provider | Public API | State Filter | JSON | Cost (5 States/yr) | Rate Limit | Docs |
|----------|-----------|-------------|------|---------------------|------------|------|
| BidAssist | Yes | Yes | Yes | ~Rs 5K+ (enterprise TBD) | 5 req/sec | Good |
| TendersOnTime | Yes | Yes | Yes | Rs 5,000 + GST | Unknown | Basic |
| Tender247 | No | Yes (web) | No | Contact sales | N/A | None |
| TenderShark | No | Yes (web) | No | Contact sales | N/A | None |
| TenderDetail | No | Yes (web) | No | Contact sales | N/A | None |
| CPPP (free) | Partial | No | HTML | Free | N/A | None |

---

## Recommendation

### Short Term: TendersOnTime API

- **Cost:** Rs 5,000/year for 5 South Indian states
- **Why:** Cheapest option with a documented REST API
- **Integration:** Simple date-based polling from Cloudflare Worker cron
- **Limitation:** Date-based queries only, no real-time search

### Long Term: BidAssist API

- **Cost:** Enterprise pricing (contact sales)
- **Why:** Richest dataset (45+ fields), ML-processed, advanced filtering
- **Integration:** `x-api-key` header, JSON response, filter by state/status/category
- **Action needed:** Contact sales for enterprise API pricing and `FEED_SOURCE_ID` values

### Free Option: CPPP Partial Scraping

- **Endpoints:**
  - `https://eprocure.gov.in/cppp/latestactivetendersnew` (10 latest, all India)
  - `https://eprocure.gov.in/cppp/tendersclosingbydays/bytoday` (closing today)
- **Data:** Published date, closing date, title, organisation
- **Limitation:** Central govt only, no state filter, max 10 results
- **Useful for:** Supplementary central govt tender feed

---

## Integration Architecture (Proposed)

```
[Tender API Provider]
        |
        v
[Cloudflare Worker - Cron: every 6 hours]
        |
        v
[D1 Database: tenders table]
        |
        v
[/api/tenders?state=Karnataka]
        |
        v
[GovMonitor Frontend - TenderWatch component]
```

### New D1 Table: `tenders`

```sql
CREATE TABLE tenders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE,
    title TEXT NOT NULL,
    organisation TEXT,
    state TEXT NOT NULL,
    category TEXT,
    estimated_value REAL,
    currency TEXT DEFAULT 'INR',
    published_date INTEGER,
    closing_date INTEGER,
    opening_date INTEGER,
    source TEXT NOT NULL,
    source_url TEXT,
    status TEXT DEFAULT 'active',
    raw_data TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_tenders_state ON tenders(state);
CREATE INDEX idx_tenders_closing ON tenders(closing_date);
CREATE INDEX idx_tenders_status ON tenders(status);
```

### New API Endpoints

- `GET /api/tenders` - List tenders (filterable by state, status, date range)
- `GET /api/tenders/stats` - Tender statistics by state
- `GET /api/tenders/:id` - Tender detail

---

## Next Steps

1. **Choose provider** - TendersOnTime (affordable) or BidAssist (feature-rich)
2. **Obtain API credentials** - Subscribe and get API key
3. **Implement D1 schema** - Create tenders table with migration
4. **Build sync worker** - Cron job to fetch and store tender data
5. **Add API endpoints** - `/api/tenders` with state filtering
6. **Update frontend** - Enhance TenderWatch component with live tender data

---

## References

- BidAssist API: https://api-doc.bidassist.com
- BidAssist Pricing: https://bidassist.com/pricing
- TendersOnTime API: https://www.tendersontime.com/tenders/api_documentation
- TendersOnTime Pricing: https://www.tendersontime.com/subscribe
- CPPP Portal: https://eprocure.gov.in/cppp/latestactivetendersnew
- data.gov.in Tender Data: https://www.data.gov.in/keywords/Tender
