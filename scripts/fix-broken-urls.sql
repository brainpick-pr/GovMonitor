-- Fix broken/unreachable URLs in GovMonitor targets
-- Generated 2026-02-06 after testing all monitored portals
--
-- Legend:
--   MIGRATED = Domain changed, old URL no longer works
--   TIMEOUT  = URL is correct but consistently times out (kept as-is or updated to alternate)
--   404      = Old URL returns 404, replaced with working URL

-- ============================================================================
-- IDENTITY & CITIZEN SERVICES
-- ============================================================================

-- NVSP (www.nvsp.in) → voters.eci.gov.in [MIGRATED]
UPDATE targets
SET url = 'https://voters.eci.gov.in',
    hostname = 'voters.eci.gov.in'
WHERE name = 'Voter Portal NVSP';

-- ============================================================================
-- FINANCIAL SERVICES
-- ============================================================================

-- NPS Portal: NSDL rebranded to Protean [MIGRATED]
UPDATE targets
SET url = 'https://www.npscra.proteantech.in',
    hostname = 'www.npscra.proteantech.in'
WHERE name = 'NPS Portal';

-- ============================================================================
-- TENDER PORTALS
-- ============================================================================

-- Gujarat eProcurement: nprocure.com → tender.nprocure.com [MIGRATED]
UPDATE targets
SET url = 'https://tender.nprocure.com',
    hostname = 'tender.nprocure.com'
WHERE name = 'Gujarat eProcurement';

-- Bihar eProcurement: eproc.bihar.gov.in → eproc2.bihar.gov.in [MIGRATED]
UPDATE targets
SET url = 'https://eproc2.bihar.gov.in',
    hostname = 'eproc2.bihar.gov.in'
WHERE name = 'Bihar eProcurement';

-- Goa eProcurement: goaenivida.gov.in → eprocure.goa.gov.in [MIGRATED]
UPDATE targets
SET url = 'https://eprocure.goa.gov.in',
    hostname = 'eprocure.goa.gov.in'
WHERE name = 'Goa eProcurement';

-- ============================================================================
-- STATE ELECTRICITY BOARDS
-- ============================================================================

-- TANGEDCO: tnebnet.org → tangedco.org [MIGRATED - old returns 404]
UPDATE targets
SET url = 'https://www.tangedco.org',
    hostname = 'www.tangedco.org'
WHERE name = 'TANGEDCO Tamil Nadu';

-- TSSPDCL → TGSPDCL: tssouthernpower.com → tgsouthernpower.org [MIGRATED - Telangana rebranding]
UPDATE targets
SET url = 'https://www.tgsouthernpower.org',
    hostname = 'www.tgsouthernpower.org',
    name = 'TGSPDCL Telangana'
WHERE name = 'TSSPDCL Telangana';

-- UPPCL: uppclonline.com → uppcl.org [MIGRATED]
UPDATE targets
SET url = 'https://www.uppcl.org',
    hostname = 'www.uppcl.org'
WHERE name = 'UPPCL UP';

-- ============================================================================
-- STATE TRANSPORT CORPORATIONS
-- ============================================================================

-- MSRTC: msrtc.gov.in → msrtc.maharashtra.gov.in [MIGRATED]
UPDATE targets
SET url = 'https://msrtc.maharashtra.gov.in',
    hostname = 'msrtc.maharashtra.gov.in'
WHERE name = 'MSRTC Maharashtra';

-- APSRTC: apsrtconline.in returns 403, use gov.in domain instead [UPDATED]
UPDATE targets
SET url = 'https://www.apsrtc.ap.gov.in',
    hostname = 'www.apsrtc.ap.gov.in'
WHERE name = 'APSRTC Andhra';

-- RSRTC: rsrtc.rajasthan.gov.in → transport.rajasthan.gov.in/rsrtc [MIGRATED]
UPDATE targets
SET url = 'https://transport.rajasthan.gov.in/rsrtc',
    hostname = 'transport.rajasthan.gov.in'
WHERE name = 'RSRTC Rajasthan';

-- ============================================================================
-- LAND RECORDS PORTALS
-- ============================================================================

-- Dharani Telangana: dharani.telangana.gov.in → bhubharati.telangana.gov.in [MIGRATED]
UPDATE targets
SET url = 'https://bhubharati.telangana.gov.in',
    hostname = 'bhubharati.telangana.gov.in',
    name = 'BhuBharati Telangana'
WHERE name = 'Dharani Telangana';

-- Apna Khata Rajasthan: raj.nic.in → rajasthan.gov.in [MIGRATED]
UPDATE targets
SET url = 'https://apnakhata.rajasthan.gov.in',
    hostname = 'apnakhata.rajasthan.gov.in'
WHERE name = 'Apna Khata Rajasthan';

-- ============================================================================
-- RTO / VEHICLE REGISTRATION
-- ============================================================================

-- mParivahan: m.parivahan.gov.in → mparivahan.parivahan.gov.in [MIGRATED]
UPDATE targets
SET url = 'https://mparivahan.parivahan.gov.in',
    hostname = 'mparivahan.parivahan.gov.in'
WHERE name = 'mParivahan';
