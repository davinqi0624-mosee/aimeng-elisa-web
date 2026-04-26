-- ============================================================
-- ELISA 生态网站 - Supabase PostgreSQL 数据库架构
-- 支持: 产品搜索/展示、RAG AI客服、实验方案、知识库、
--       论文积分、积分商城、会员体系
-- ============================================================

-- 1. 启用必要扩展
-- ============================================================
create extension if not exists vector;      -- RAG 向量检索 (pgvector)
create extension if not exists pg_trgm;     -- 模糊搜索/相似度匹配
create extension if not exists unaccent;    -- 希腊字母/重音符号归一化

-- 2. 用户档案表 (扩展 auth.users)
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  institution text,                        -- 所属机构
  membership_level text default 'free',    -- free | silver | gold | platinum
  total_points integer default 0,          -- 累计积分(只增不减)
  available_points integer default 0,      -- 可用积分(可消费)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table profiles is '用户公开档案与积分余额';
comment on column profiles.membership_level is '会员等级: free, silver, gold, platinum';

-- 自动创建 profile 触发器
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. 产品分类表
-- ============================================================
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  description text,
  parent_id uuid references categories(id) on delete set null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 4. 产品表 (ELISA 试剂盒)
-- ============================================================
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  name text not null,                      -- 如 "Human IL-6 ELISA Kit"
  slug text unique,
  description text,
  category_id uuid references categories(id) on delete set null,
  target text not null,                    -- 靶标: IL-6, TNF-alpha
  detection_range text,                    -- 检测范围
  sensitivity text,                        -- 灵敏度
  sample_type text[],                      -- 支持的样本类型数组
  price decimal(10,2),
  currency text default 'CNY',
  image_url text,
  datasheet_url text,                      -- 说明书 PDF
  is_featured boolean default false,         -- 是否首页推荐
  stock_status text default 'in_stock',    -- in_stock | low_stock | out_of_stock
  status text default 'active',            -- active | draft | archived
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. 产品别名表 (支持希腊字母与缩写模糊搜索)
-- ============================================================
create table if not exists product_aliases (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products(id) on delete cascade not null,
  alias text not null,                     -- 如 "α", "alpha", "IL-1β", "Interleukin 6"
  alias_type text default 'synonym',       -- greek | abbreviation | synonym | species
  language text default 'en',              -- en | zh
  search_vector tsvector,                  -- 全文搜索向量(预计算)
  created_at timestamptz default now()
);

-- 6. 产品-种属关联表 (种属筛选)
-- ============================================================
create table if not exists product_species (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products(id) on delete cascade not null,
  species text not null,                   -- Human | Mouse | Rat | Rabbit | Monkey | Porcine | Bovine | Canine | Feline | General
  species_name_zh text,                    -- 中文名: 人、小鼠、大鼠
  is_primary boolean default false,        -- 是否主要种属
  created_at timestamptz default now(),
  unique(product_id, species)
);

-- 7. 知识库表 (RAG 源文档)
-- ============================================================
create table if not exists knowledge_base (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,                   -- 原始 Markdown/HTML
  source_type text default 'article',      -- documentation | faq | protocol | troubleshooting | news
  category text,
  tags text[],
  metadata jsonb default '{}',             -- 额外元数据
  is_published boolean default false,
  publish_date date,
  view_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. 知识库向量切片表 (RAG 检索核心)
-- ============================================================
create table if not exists knowledge_chunks (
  id uuid default gen_random_uuid() primary key,
  knowledge_id uuid references knowledge_base(id) on delete cascade not null,
  content text not null,                   -- 切片后的文本(约 500-1000 tokens)
  embedding vector(1536),                -- OpenAI text-embedding-3-small
  chunk_index integer not null,            -- 切片序号
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 向量相似度搜索索引 (IVFFlat / HNSW)
create index if not exists idx_knowledge_chunks_embedding
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- 9. AI 客服对话表
-- ============================================================
create table if not exists ai_conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  title text default 'New Conversation',
  scenario text default 'pre_sales',       -- pre_sales | after_sales | experiment | data_analysis
  status text default 'active',            -- active | closed | archived
  last_message_at timestamptz,
  created_at timestamptz default now()
);

-- 10. AI 消息表
-- ============================================================
create table if not exists ai_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references ai_conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb default '[]',              -- RAG 引用的知识库来源 [{knowledge_id, title, snippet}]
  tokens_used integer,                     -- 消耗的 token 数
  latency_ms integer,                      -- 响应延迟
  created_at timestamptz default now()
);

-- 11. 实验方案表
-- ============================================================
create table if not exists experiments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  kit_product_id uuid references products(id) on delete set null,
  objective text,                          -- 实验目的
  protocol jsonb default '{}',             -- 完整步骤: {steps: [{step, description, duration, temp}]}
  parameters jsonb default '{}',           -- 参数: {sample_type, dilution, incubation_time, wavelength}
  calculated_data jsonb,                   -- 计算结果: {standard_curve, equation, r_squared}
  is_template boolean default false,       -- 是否公开模板
  is_public boolean default false,         -- 是否社区共享
  status text default 'draft',             -- draft | running | completed | archived
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 12. 数据分析报告表
-- ============================================================
create table if not exists analysis_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  title text,
  experiment_id uuid references experiments(id) on delete set null,
  raw_data jsonb,                          -- 原始 OD 值矩阵
  processed_data jsonb,                    -- 拟合后的浓度数据
  standard_curve jsonb,                    -- 标准曲线参数 {slope, intercept, r2}
  report_config jsonb default '{}',        -- 报告样式配置
  file_url text,                           -- 生成的 PDF/Excel URL
  status text default 'pending',           -- pending | processing | completed | failed
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 13. 每日知识表
-- ============================================================
create table if not exists daily_knowledge (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  summary text,                              -- 摘要
  content text not null,                     -- 正文
  tag text,                                  -- 分类标签
  cover_image text,
  publish_date date default current_date,
  is_published boolean default false,
  view_count integer default 0,
  like_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 14. 论文上传表
-- ============================================================
create table if not exists papers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  authors text,
  journal text,
  doi text,
  url text,
  publication_date date,
  abstract text,
  product_id uuid references products(id) on delete set null,  -- 关联使用的 ELISA 产品
  upload_status text default 'pending',      -- pending | under_review | verified | rejected
  rejection_reason text,
  points_awarded integer default 0,          -- 审核通过后发放的积分
  is_featured boolean default false,         -- 是否首页展示
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 15. 积分交易流水表 (核心: 不可删改)
-- ============================================================
create table if not exists point_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  amount integer not null,                   -- 正数:获得积分  负数:消费积分
  balance_after integer not null,            -- 交易后余额快照
  type text not null,                        -- paper_upload | daily_login | purchase | redeem | referral | bonus | correction
  source_id uuid,                            -- 关联来源表 ID(如 paper_id, order_id)
  source_table text,                         -- papers | redeem_orders | shop_items
  description text not null,                 -- 交易说明
  ip_address inet,                           -- 可选: 防刷
  created_at timestamptz default now()
);

comment on table point_transactions is '积分流水: 所有积分变动必须记录于此';

-- 16. 积分奖励规则表
-- ============================================================
create table if not exists point_rewards (
  id uuid default gen_random_uuid() primary key,
  rule_code text unique not null,            -- PAPER_UPLOAD | DAILY_LOGIN | FIRST_PURCHASE
  name text not null,
  description text,
  points_amount integer not null,
  limit_type text default 'none',            -- none | daily | weekly | monthly | once_per_user
  limit_count integer,                       -- 限制次数
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 17. 积分商城商品表
-- ============================================================
create table if not exists shop_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  image_url text,
  points_required integer not null,
  stock_quantity integer default 0,
  is_virtual boolean default false,          -- true: 电子券/下载链接  false: 实物
  virtual_content text,                      -- 虚拟商品内容(如兑换码、链接)
  is_active boolean default true,
  category text,                               -- reagent | gift | coupon | service
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 18. 兑换订单表
-- ============================================================
create table if not exists redeem_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  item_id uuid references shop_items(id) on delete restrict not null,
  quantity integer default 1 not null,
  points_spent integer not null,
  status text default 'pending',             -- pending | processing | shipped | completed | cancelled
  shipping_address jsonb,                    -- 实物邮寄地址
  tracking_number text,                      -- 物流单号
  remark text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 索引优化
-- ============================================================

-- 搜索相关
create index idx_product_aliases_alias on product_aliases using gin(alias gin_trgm_ops);
create index idx_product_aliases_alias_type on product_aliases(alias_type);
create index idx_products_target on products using gin(target gin_trgm_ops);
create index idx_products_name on products using gin(name gin_trgm_ops);
create index idx_products_category on products(category_id);
create index idx_products_featured on products(is_featured) where is_featured = true;
create index idx_product_species_species on product_species(species);

-- 知识/RAG 相关
create index idx_knowledge_base_publish on knowledge_base(is_published, publish_date);
create index idx_knowledge_chunks_knowledge on knowledge_chunks(knowledge_id);
create index idx_daily_knowledge_publish on daily_knowledge(publish_date, is_published);

-- 积分/社区相关
create index idx_papers_user on papers(user_id);
create index idx_papers_status on papers(upload_status);
create index idx_papers_product on papers(product_id);
create index idx_point_transactions_user on point_transactions(user_id, created_at desc);
create index idx_point_transactions_type on point_transactions(type);
create index idx_redeem_orders_user on redeem_orders(user_id, created_at desc);

-- AI 相关
create index idx_ai_conversations_user on ai_conversations(user_id, last_message_at desc);
create index idx_ai_messages_conversation on ai_messages(conversation_id, created_at);

-- ============================================================
-- Row Level Security (RLS) 策略
-- ============================================================

-- 用户表: 所有人可读公开字段，仅自己和管理员可写
alter table profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- 产品/分类/别名/种属: 公开读取
alter table categories enable row level security;
alter table products enable row level security;
alter table product_aliases enable row level security;
alter table product_species enable row level security;

create policy "Products are publicly readable"
  on products for select using (status = 'active');

create policy "Categories are publicly readable"
  on categories for select using (is_active = true);

create policy "Product aliases are publicly readable"
  on product_aliases for select using (true);

create policy "Product species are publicly readable"
  on product_species for select using (true);

-- 知识库: 已发布公开，草稿仅管理员
alter table knowledge_base enable row level security;
alter table knowledge_chunks enable row level security;

create policy "Published knowledge is public"
  on knowledge_base for select using (is_published = true);

create policy "Knowledge chunks are public"
  on knowledge_chunks for select using (
    exists (
      select 1 from knowledge_base kb where kb.id = knowledge_chunks.knowledge_id and kb.is_published = true
    )
  );

-- 每日知识: 已发布公开
alter table daily_knowledge enable row level security;

create policy "Published daily knowledge is public"
  on daily_knowledge for select using (is_published = true);

-- 实验方案: 公开模板可读，私人仅自己
alter table experiments enable row level security;

create policy "Public experiments are viewable"
  on experiments for select using (is_public = true or user_id = auth.uid());

create policy "Users can manage own experiments"
  on experiments for all using (user_id = auth.uid());

-- 分析报告: 仅自己
alter table analysis_reports enable row level security;

create policy "Users can view own reports"
  on analysis_reports for select using (user_id = auth.uid());

create policy "Users can insert own reports"
  on analysis_reports for insert with check (user_id = auth.uid());

-- 论文: 审核通过公开，上传者始终可见
alter table papers enable row level security;

create policy "Verified papers are public"
  on papers for select using (upload_status = 'verified');

create policy "Users can view own papers"
  on papers for select using (user_id = auth.uid());

create policy "Users can insert own papers"
  on papers for insert with check (user_id = auth.uid());

create policy "Users can update own papers"
  on papers for update using (user_id = auth.uid());

-- 积分流水: 仅自己可见
alter table point_transactions enable row level security;

create policy "Users can view own transactions"
  on point_transactions for select using (user_id = auth.uid());

-- 商城商品: 公开读取
alter table shop_items enable row level security;

create policy "Active shop items are public"
  on shop_items for select using (is_active = true);

-- 兑换订单: 仅自己
alter table redeem_orders enable row level security;

create policy "Users can view own orders"
  on redeem_orders for select using (user_id = auth.uid());

create policy "Users can insert own orders"
  on redeem_orders for insert with check (user_id = auth.uid());

-- AI 对话: 仅自己
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;

create policy "Users can view own conversations"
  on ai_conversations for select using (user_id = auth.uid() or user_id is null);

create policy "Users can insert own conversations"
  on ai_conversations for insert with check (user_id = auth.uid() or user_id is null);

create policy "Users can view own messages"
  on ai_messages for select using (
    exists (
      select 1 from ai_conversations c where c.id = ai_messages.conversation_id and (c.user_id = auth.uid() or c.user_id is null)
    )
  );

create policy "Users can insert own messages"
  on ai_messages for insert with check (
    exists (
      select 1 from ai_conversations c where c.id = ai_messages.conversation_id and (c.user_id = auth.uid() or c.user_id is null)
    )
  );

-- ============================================================
-- 辅助函数: 自动更新 updated_at
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 为所有含 updated_at 的表绑定触发器
do $$
declare
  r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where column_name = 'updated_at'
    and table_schema = 'public'
    and table_name not in ('point_transactions', 'knowledge_chunks', 'ai_messages')
  loop
    execute format('
      create or replace trigger trg_%I_updated_at
      before update on %I
      for each row execute function update_updated_at_column();
    ', r.table_name, r.table_name);
  end loop;
end $$;

-- ============================================================
-- 种子数据: 积分奖励规则
-- ============================================================
insert into point_rewards (rule_code, name, description, points_amount, limit_type, limit_count, is_active)
values
  ('PAPER_UPLOAD', '论文上传奖励', '上传一篇使用本公司ELISA产品的SCI论文', 500, 'once_per_user', null, true),
  ('DAILY_LOGIN', '每日登录', '每日首次登录奖励', 10, 'daily', 1, true),
  ('COMPLETE_PROFILE', '完善资料', '完善个人/机构资料', 50, 'once_per_user', 1, true);
