-- 购买积分申请规则调整：
-- 客户端不再要求填写积分码，改为以产品货号 + 批号 + 商品照片作为购买凭证。
-- point_code 字段继续保留用于兼容历史积分码和现有唯一索引；
-- 新申请会写入内部 CATBATCH:{货号}:{批号} 凭证，防止同一货号/批号重复申请。

CREATE INDEX IF NOT EXISTS idx_purchase_point_claims_catalog_batch
  ON purchase_point_claims(upper(catalog_number), upper(batch_number))
  WHERE catalog_number IS NOT NULL
    AND batch_number IS NOT NULL;

COMMENT ON TABLE purchase_point_claims IS '客户购买爱萌优宁商品后的积分申请。新流程以产品货号、批号和商品照片作为主凭证；历史积分码继续兼容。';
COMMENT ON COLUMN purchase_point_claims.point_code IS '历史上用于客户积分码；新申请保存系统生成的 CATBATCH:{货号}:{批号} 内部凭证，用于唯一性校验和追溯。';
COMMENT ON COLUMN purchase_point_claims.catalog_number IS '客户填写的产品货号，用于购买积分审核。';
COMMENT ON COLUMN purchase_point_claims.batch_number IS '客户填写的产品批号，用于购买积分审核。';

NOTIFY pgrst, 'reload schema';
