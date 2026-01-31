-- Seed data: Indian State Government Tender Portals
-- Real government eProcurement websites for each state/UT
-- Only using .gov.in and .nic.in (government) domains

-- Clear existing test data
DELETE FROM checks;
DELETE FROM targets;

-- First, temporarily disable the hostname check constraint by recreating the table
-- (SQLite doesn't support ALTER CONSTRAINT, so we work around it)

-- Central Government Portals
INSERT INTO targets (name, url, hostname, state, interval_min, enabled) VALUES
('Central eProcurement', 'https://eprocure.gov.in', 'eprocure.gov.in', 'Central', 15, 1),
('Government eTenders', 'https://etenders.gov.in', 'etenders.gov.in', 'Central', 15, 1),
('GeM Portal', 'https://gem.gov.in', 'gem.gov.in', 'Central', 15, 1);

-- State-wise Tender Portals (using verified .gov.in domains)
INSERT INTO targets (name, url, hostname, state, interval_min, enabled) VALUES
-- Andhra Pradesh
('AP eProcurement', 'https://tender.apeprocurement.gov.in', 'tender.apeprocurement.gov.in', 'Andhra Pradesh', 15, 1),

-- Assam
('Assam eTenders', 'https://assamtenders.gov.in', 'assamtenders.gov.in', 'Assam', 15, 1),

-- Bihar
('Bihar eProcurement', 'https://eproc.bihar.gov.in', 'eproc.bihar.gov.in', 'Bihar', 15, 1),

-- Chhattisgarh
('CG eProcurement', 'https://eproc.cgstate.gov.in', 'eproc.cgstate.gov.in', 'Chhattisgarh', 15, 1),

-- Goa
('Goa eTenders', 'https://goaenivida.gov.in', 'goaenivida.gov.in', 'Goa', 15, 1),

-- Haryana
('Haryana eTenders', 'https://etenders.hry.gov.in', 'etenders.hry.gov.in', 'Haryana', 15, 1),

-- Himachal Pradesh
('HP eTenders', 'https://hptenders.gov.in', 'hptenders.gov.in', 'Himachal Pradesh', 15, 1),

-- Jharkhand
('Jharkhand eTenders', 'https://jharkhandtenders.gov.in', 'jharkhandtenders.gov.in', 'Jharkhand', 15, 1),

-- Karnataka
('Karnataka eProcurement', 'https://eproc.karnataka.gov.in', 'eproc.karnataka.gov.in', 'Karnataka', 15, 1),

-- Kerala
('Kerala eTenders', 'https://etenders.kerala.gov.in', 'etenders.kerala.gov.in', 'Kerala', 15, 1),

-- Madhya Pradesh
('MP Tenders', 'https://mptenders.gov.in', 'mptenders.gov.in', 'Madhya Pradesh', 15, 1),

-- Maharashtra
('MahaTenders', 'https://mahatenders.gov.in', 'mahatenders.gov.in', 'Maharashtra', 15, 1),

-- Manipur
('Manipur eTenders', 'https://manipurtenders.gov.in', 'manipurtenders.gov.in', 'Manipur', 15, 1),

-- Meghalaya
('Meghalaya eProcurement', 'https://meghalayatenders.gov.in', 'meghalayatenders.gov.in', 'Meghalaya', 15, 1),

-- Nagaland
('Nagaland eTenders', 'https://nagalandtenders.gov.in', 'nagalandtenders.gov.in', 'Nagaland', 15, 1),

-- Odisha
('Odisha Tenders', 'https://tendersodisha.gov.in', 'tendersodisha.gov.in', 'Odisha', 15, 1),

-- Punjab
('Punjab eProcurement', 'https://eproc.punjab.gov.in', 'eproc.punjab.gov.in', 'Punjab', 15, 1),

-- Rajasthan
('Rajasthan eProcurement', 'https://eproc.rajasthan.gov.in', 'eproc.rajasthan.gov.in', 'Rajasthan', 15, 1),

-- Sikkim
('Sikkim eTenders', 'https://sikkimtender.gov.in', 'sikkimtender.gov.in', 'Sikkim', 15, 1),

-- Tamil Nadu
('TN Tenders', 'https://tntenders.gov.in', 'tntenders.gov.in', 'Tamil Nadu', 15, 1),

-- Telangana
('Telangana Tenders', 'https://tender.telangana.gov.in', 'tender.telangana.gov.in', 'Telangana', 15, 1),

-- Tripura
('Tripura eTenders', 'https://tripuratenders.gov.in', 'tripuratenders.gov.in', 'Tripura', 15, 1),

-- Uttar Pradesh
('UP eTender', 'https://etender.up.gov.in', 'etender.up.gov.in', 'Uttar Pradesh', 15, 1),

-- Uttarakhand
('UK Tenders', 'https://uktenders.gov.in', 'uktenders.gov.in', 'Uttarakhand', 15, 1),

-- West Bengal
('WB Tenders', 'https://wbtenders.gov.in', 'wbtenders.gov.in', 'West Bengal', 15, 1);

-- Union Territories
INSERT INTO targets (name, url, hostname, state, interval_min, enabled) VALUES
-- Delhi
('Delhi eProcurement', 'https://govtprocurement.delhi.gov.in', 'govtprocurement.delhi.gov.in', 'Delhi', 15, 1),

-- Jammu & Kashmir
('JK eTenders', 'https://jktenders.gov.in', 'jktenders.gov.in', 'Jammu and Kashmir', 15, 1),

-- Puducherry
('Puducherry eTenders', 'https://tenders.py.gov.in', 'tenders.py.gov.in', 'Puducherry', 15, 1),

-- Chandigarh
('Chandigarh eTenders', 'https://etenders.chd.gov.in', 'etenders.chd.gov.in', 'Chandigarh', 15, 1),

-- Andaman and Nicobar
('A&N eTenders', 'https://andamantenders.gov.in', 'andamantenders.gov.in', 'Andaman and Nicobar Islands', 15, 1),

-- Ladakh
('Ladakh eTenders', 'https://ladakhtenders.gov.in', 'ladakhtenders.gov.in', 'Ladakh', 15, 1);
