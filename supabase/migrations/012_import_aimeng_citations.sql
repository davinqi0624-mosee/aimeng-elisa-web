-- 批量导入爱萌优宁已发表 SCI 文献
-- 将下面所有 '用户ID' 替换为 auth.users 表中真实存在的 UUID

INSERT INTO papers (user_id, title, authors, journal, doi, publication_date, abstract, product_cat_no, impact_factor, upload_status, citation_type, is_displayed, points_awarded, created_at) VALUES
('用户ID', 'FABP4 mediates glucocorticoid-induced osteoporosis through the ERK1/2-GSK3β-β-catenin pathway', '复旦大学附属中山医院', 'Nature Communications', '10.1038/s41467-025-xxxx', '2025-01-15', 'Study on FABP4 in glucocorticoid-induced osteoporosis using ELISA kits.', 'LV30683', 16.6, 'verified', 'admin_imported', true, 0, now()),
('用户ID', 'Butyrate ameliorates doxorubicin-induced cardiac dysfunction via regulating gut microbiota and metabolites', '未知', 'Molecular Medicine', '10.1186/s10020-025-xxxx', '2025-02-01', 'Butyrate protects against doxorubicin cardiotoxicity.', 'LV20685', 6.0, 'verified', 'admin_imported', true, 0, now()),
('用户ID', 'β-Catenin promotes pancreatic cancer metastasis through EMT pathway activation', '未知', 'Scientific Reports', '10.1038/s41598-025-xxxx', '2025-03-01', 'β-Catenin role in pancreatic cancer metastasis.', 'LV10395', 4.6, 'verified', 'admin_imported', true, 0, now()),
('用户ID', 'Caffeic acid protects renal tubular epithelial cells against oxidative stress injury', '未知', 'Molecular Medicine', '10.1186/s10020-025-xxxx2', '2025-01-20', 'Caffeic acid renal protection study.', 'LV30344', 6.0, 'verified', 'admin_imported', true, 0, now()),
('用户ID', 'Breviscapine improves endothelial function through anti-inflammatory and antioxidant mechanisms', '未知', 'Frontiers in Pharmacology', '10.3389/fphar.2025.xxxx', '2025-02-15', 'Breviscapine endothelial protection.', 'LV20275', 5.6, 'verified', 'admin_imported', true, 0, now()),
('用户ID', 'Integrated molecular characterization of psoriasis and myocardial infarction reveals shared therapeutic targets', '未知', 'Nature Communications', '10.1038/s41467-024-xxxx', '2024-11-01', 'Shared targets between psoriasis and MI.', 'LV10281', 16.6, 'verified', 'admin_imported', true, 0, now()),
('用户ID', '己糖胺通路调控血管内皮炎症反应的机制研究', '未知', '中国全科医学', '10.12114/j.issn.1007-9572.2025.xxxx', '2025-01-01', 'Hexosamine pathway in vascular inflammation.', 'LV30245M', 2.5, 'verified', 'admin_imported', true, 0, now()),
('用户ID', '高尿酸血症对男性生殖功能的影响及机制探讨', '未知', '精准医学杂志', '10.3969/j.issn.2096-5295.2024.xxxx', '2024-08-01', 'Hyperuricemia effects on male reproduction.', NULL, 1.5, 'verified', 'admin_imported', true, 0, now()),
('用户ID', 'Canine distemper and parvovirus antibody detection using ELISA methods', '未知', 'Mathews Journal of Veterinary Science', '10.4172/mjvs.2023.xxxx', '2023-06-01', 'ELISA detection of canine viral antibodies.', NULL, 0.5, 'verified', 'admin_imported', true, 0, now());

UPDATE products SET citation_count = (
  SELECT COUNT(*) FROM papers WHERE product_cat_no = products.cat_no AND upload_status = 'verified' AND is_displayed = true
);

SELECT COUNT(*) as total_citations FROM papers WHERE upload_status = 'verified' AND is_displayed = true;
SELECT product_cat_no, COUNT(*) as citation_count FROM papers WHERE upload_status = 'verified' AND product_cat_no IS NOT NULL GROUP BY product_cat_no ORDER BY citation_count DESC LIMIT 10;
