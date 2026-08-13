--
-- PostgreSQL database dump
--

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    action text NOT NULL,
    user_id text,
    user_role text,
    entity text NOT NULL,
    entity_id text,
    before_json jsonb,
    after_json jsonb,
    status text DEFAULT 'SUCCESS'::text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: caixa_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_sessions (
    id text NOT NULL,
    status text NOT NULL,
    opened_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    opened_by text,
    closed_by text,
    total_sales numeric(14,2) DEFAULT 0 NOT NULL,
    attendance_count integer DEFAULT 0 NOT NULL,
    expected_totals jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT caixa_sessions_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text])))
);


--
-- Name: comanda_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comanda_items (
    id text NOT NULL,
    comanda_numero text NOT NULL,
    name text NOT NULL,
    quantity numeric(14,3) DEFAULT 0 NOT NULL,
    weight numeric(14,3),
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    by_weight boolean DEFAULT false NOT NULL,
    by_unit boolean DEFAULT false NOT NULL,
    launch_source text,
    raw_json jsonb NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: comanda_pesagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comanda_pesagens (
    id text NOT NULL,
    comanda_numero text NOT NULL,
    weight numeric(14,3) NOT NULL,
    origin text,
    owner text,
    station_id text,
    item_id text,
    product_name text,
    reason text,
    created_at timestamp with time zone NOT NULL,
    raw_json jsonb NOT NULL
);


--
-- Name: comandas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comandas (
    numero text NOT NULL,
    status text NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    opened_at timestamp with time zone NOT NULL,
    closed_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL,
    active boolean DEFAULT true NOT NULL,
    lock_json jsonb,
    source_snapshot jsonb NOT NULL
);


--
-- Name: financeiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro (
    id text NOT NULL,
    finance_code text,
    tab text NOT NULL,
    movement_type text,
    category text,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    description text,
    account_name text,
    document_ref text,
    status text NOT NULL,
    due_date date,
    competence_date date,
    supplier_name text,
    convenio_id text,
    convenio_name text,
    payment_method text,
    launched_at timestamp with time zone,
    source_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pagamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagamentos (
    id text NOT NULL,
    venda_id text NOT NULL,
    method text NOT NULL,
    label text,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_card_administrators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_card_administrators (
    id text NOT NULL,
    code text,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_categories (
    id text NOT NULL,
    code text,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_clients (
    id text NOT NULL,
    code text,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_comanda_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_comanda_audit (
    id bigint NOT NULL,
    action text NOT NULL,
    numero text NOT NULL,
    event jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_comanda_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pdv_comanda_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pdv_comanda_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pdv_comanda_audit_id_seq OWNED BY public.pdv_comanda_audit.id;


--
-- Name: pdv_comanda_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_comanda_state (
    id smallint NOT NULL,
    snapshot jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pdv_comanda_state_id_check CHECK ((id = 1))
);


--
-- Name: pdv_convenios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_convenios (
    id text NOT NULL,
    code text,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_employees (
    id text NOT NULL,
    code text,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_fiscal_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_fiscal_settings (
    id text NOT NULL,
    store_id text,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_peripheral_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_peripheral_settings (
    id text NOT NULL,
    store_id text,
    computer_name text,
    peripheral_type text NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_products (
    id text NOT NULL,
    product_code text NOT NULL,
    barcode text,
    image_url text,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    is_unavailable boolean DEFAULT false NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    ncm text,
    cfop text,
    cst_icms text,
    tax_situation_code text,
    aliq_icms text,
    cst_pis text,
    aliq_pis text,
    cst_cofins text,
    aliq_cofins text,
    fiscal_type text,
    purchase_unit text,
    sale_unit text,
    units_per_purchase numeric(12,2) DEFAULT 1 NOT NULL,
    purchase_cost_value numeric(14,2) DEFAULT 0 NOT NULL,
    cost_value numeric(14,2) DEFAULT 0 NOT NULL,
    margin_profit numeric(10,2) DEFAULT 0 NOT NULL,
    price numeric(14,2) DEFAULT 0 NOT NULL,
    by_weight boolean DEFAULT false NOT NULL,
    stock numeric(14,2) DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_synced_at timestamp with time zone
);


--
-- Name: pdv_sefaz_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_sefaz_settings (
    id text NOT NULL,
    store_id text,
    name text NOT NULL,
    environment text DEFAULT 'HOMOLOGACAO'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_store_pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_store_pins (
    id text NOT NULL,
    store_id text,
    role text NOT NULL,
    pin_kind text NOT NULL,
    pin_value text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pdv_store_pins_pin_kind_check CHECK ((pin_kind = ANY (ARRAY['LOGIN'::text, 'SENSITIVE'::text])))
);


--
-- Name: pdv_store_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_store_users (
    id text NOT NULL,
    store_id text,
    role text NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_stores (
    id text NOT NULL,
    code text,
    name text NOT NULL,
    legal_name text,
    trade_name text,
    cnpj text,
    state_registration text,
    commercial_status text DEFAULT 'EM_DIA'::text NOT NULL,
    allowed_roles text[] DEFAULT ARRAY[]::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_suppliers (
    id text NOT NULL,
    code text,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdv_support_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdv_support_settings (
    id text NOT NULL,
    store_id text,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendas (
    id text NOT NULL,
    comanda_numero text,
    document_mode text NOT NULL,
    status text DEFAULT 'CLOSED'::text NOT NULL,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    discount numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    operator text,
    pdv text,
    customer_document text,
    source text DEFAULT 'BACKEND'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    CONSTRAINT vendas_document_mode_check CHECK ((document_mode = ANY (ARRAY['NFCE'::text, 'ORCAMENTO'::text])))
);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: pdv_comanda_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_comanda_audit ALTER COLUMN id SET DEFAULT nextval('public.pdv_comanda_audit_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: caixa_sessions caixa_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_sessions
    ADD CONSTRAINT caixa_sessions_pkey PRIMARY KEY (id);


--
-- Name: comanda_items comanda_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_items
    ADD CONSTRAINT comanda_items_pkey PRIMARY KEY (id);


--
-- Name: comanda_pesagens comanda_pesagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_pesagens
    ADD CONSTRAINT comanda_pesagens_pkey PRIMARY KEY (id);


--
-- Name: comandas comandas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandas
    ADD CONSTRAINT comandas_pkey PRIMARY KEY (numero);


--
-- Name: financeiro financeiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro
    ADD CONSTRAINT financeiro_pkey PRIMARY KEY (id);


--
-- Name: pagamentos pagamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_pkey PRIMARY KEY (id);


--
-- Name: pdv_card_administrators pdv_card_administrators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_card_administrators
    ADD CONSTRAINT pdv_card_administrators_pkey PRIMARY KEY (id);


--
-- Name: pdv_categories pdv_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_categories
    ADD CONSTRAINT pdv_categories_pkey PRIMARY KEY (id);


--
-- Name: pdv_clients pdv_clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_clients
    ADD CONSTRAINT pdv_clients_pkey PRIMARY KEY (id);


--
-- Name: pdv_comanda_audit pdv_comanda_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_comanda_audit
    ADD CONSTRAINT pdv_comanda_audit_pkey PRIMARY KEY (id);


--
-- Name: pdv_comanda_state pdv_comanda_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_comanda_state
    ADD CONSTRAINT pdv_comanda_state_pkey PRIMARY KEY (id);


--
-- Name: pdv_convenios pdv_convenios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_convenios
    ADD CONSTRAINT pdv_convenios_pkey PRIMARY KEY (id);


--
-- Name: pdv_employees pdv_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_employees
    ADD CONSTRAINT pdv_employees_pkey PRIMARY KEY (id);


--
-- Name: pdv_fiscal_settings pdv_fiscal_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_fiscal_settings
    ADD CONSTRAINT pdv_fiscal_settings_pkey PRIMARY KEY (id);


--
-- Name: pdv_peripheral_settings pdv_peripheral_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_peripheral_settings
    ADD CONSTRAINT pdv_peripheral_settings_pkey PRIMARY KEY (id);


--
-- Name: pdv_products pdv_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_products
    ADD CONSTRAINT pdv_products_pkey PRIMARY KEY (id);


--
-- Name: pdv_products pdv_products_product_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_products
    ADD CONSTRAINT pdv_products_product_code_key UNIQUE (product_code);


--
-- Name: pdv_sefaz_settings pdv_sefaz_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_sefaz_settings
    ADD CONSTRAINT pdv_sefaz_settings_pkey PRIMARY KEY (id);


--
-- Name: pdv_store_pins pdv_store_pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_store_pins
    ADD CONSTRAINT pdv_store_pins_pkey PRIMARY KEY (id);


--
-- Name: pdv_store_pins pdv_store_pins_store_id_role_pin_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_store_pins
    ADD CONSTRAINT pdv_store_pins_store_id_role_pin_kind_key UNIQUE (store_id, role, pin_kind);


--
-- Name: pdv_store_users pdv_store_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_store_users
    ADD CONSTRAINT pdv_store_users_pkey PRIMARY KEY (id);


--
-- Name: pdv_stores pdv_stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_stores
    ADD CONSTRAINT pdv_stores_pkey PRIMARY KEY (id);


--
-- Name: pdv_suppliers pdv_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_suppliers
    ADD CONSTRAINT pdv_suppliers_pkey PRIMARY KEY (id);


--
-- Name: pdv_support_settings pdv_support_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_support_settings
    ADD CONSTRAINT pdv_support_settings_pkey PRIMARY KEY (id);


--
-- Name: vendas vendas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT vendas_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity, entity_id);


--
-- Name: idx_comanda_items_numero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comanda_items_numero ON public.comanda_items USING btree (comanda_numero);


--
-- Name: idx_comandas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_status ON public.comandas USING btree (status);


--
-- Name: idx_financeiro_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_financeiro_status ON public.financeiro USING btree (status);


--
-- Name: idx_pagamentos_venda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagamentos_venda ON public.pagamentos USING btree (venda_id);


--
-- Name: idx_pdv_card_administrators_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_card_administrators_active ON public.pdv_card_administrators USING btree (active);


--
-- Name: idx_pdv_card_administrators_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_card_administrators_name ON public.pdv_card_administrators USING btree (name);


--
-- Name: idx_pdv_categories_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_categories_active ON public.pdv_categories USING btree (active);


--
-- Name: idx_pdv_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_categories_name ON public.pdv_categories USING btree (name);


--
-- Name: idx_pdv_clients_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_clients_active ON public.pdv_clients USING btree (active);


--
-- Name: idx_pdv_clients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_clients_name ON public.pdv_clients USING btree (name);


--
-- Name: idx_pdv_convenios_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_convenios_active ON public.pdv_convenios USING btree (active);


--
-- Name: idx_pdv_convenios_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_convenios_name ON public.pdv_convenios USING btree (name);


--
-- Name: idx_pdv_employees_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_employees_active ON public.pdv_employees USING btree (active);


--
-- Name: idx_pdv_employees_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_employees_name ON public.pdv_employees USING btree (name);


--
-- Name: idx_pdv_fiscal_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_fiscal_store ON public.pdv_fiscal_settings USING btree (store_id);


--
-- Name: idx_pdv_peripheral_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_peripheral_store ON public.pdv_peripheral_settings USING btree (store_id);


--
-- Name: idx_pdv_products_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_products_barcode ON public.pdv_products USING btree (barcode);


--
-- Name: idx_pdv_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_products_category ON public.pdv_products USING btree (category);


--
-- Name: idx_pdv_products_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_products_name ON public.pdv_products USING gin (to_tsvector('portuguese'::regconfig, name));


--
-- Name: idx_pdv_sefaz_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_sefaz_store ON public.pdv_sefaz_settings USING btree (store_id);


--
-- Name: idx_pdv_store_pins_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_store_pins_store ON public.pdv_store_pins USING btree (store_id);


--
-- Name: idx_pdv_store_users_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_store_users_store ON public.pdv_store_users USING btree (store_id);


--
-- Name: idx_pdv_stores_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_stores_active ON public.pdv_stores USING btree (active);


--
-- Name: idx_pdv_stores_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_stores_name ON public.pdv_stores USING btree (name);


--
-- Name: idx_pdv_suppliers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_suppliers_active ON public.pdv_suppliers USING btree (active);


--
-- Name: idx_pdv_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdv_suppliers_name ON public.pdv_suppliers USING btree (name);


--
-- Name: idx_vendas_closed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendas_closed_at ON public.vendas USING btree (closed_at);


--
-- Name: comanda_items comanda_items_comanda_numero_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_items
    ADD CONSTRAINT comanda_items_comanda_numero_fkey FOREIGN KEY (comanda_numero) REFERENCES public.comandas(numero) ON DELETE CASCADE;


--
-- Name: comanda_pesagens comanda_pesagens_comanda_numero_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comanda_pesagens
    ADD CONSTRAINT comanda_pesagens_comanda_numero_fkey FOREIGN KEY (comanda_numero) REFERENCES public.comandas(numero) ON DELETE CASCADE;


--
-- Name: pagamentos pagamentos_venda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagamentos
    ADD CONSTRAINT pagamentos_venda_id_fkey FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;


--
-- Name: pdv_fiscal_settings pdv_fiscal_settings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_fiscal_settings
    ADD CONSTRAINT pdv_fiscal_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.pdv_stores(id) ON DELETE CASCADE;


--
-- Name: pdv_peripheral_settings pdv_peripheral_settings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_peripheral_settings
    ADD CONSTRAINT pdv_peripheral_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.pdv_stores(id) ON DELETE SET NULL;


--
-- Name: pdv_sefaz_settings pdv_sefaz_settings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_sefaz_settings
    ADD CONSTRAINT pdv_sefaz_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.pdv_stores(id) ON DELETE CASCADE;


--
-- Name: pdv_store_pins pdv_store_pins_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_store_pins
    ADD CONSTRAINT pdv_store_pins_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.pdv_stores(id) ON DELETE CASCADE;


--
-- Name: pdv_store_users pdv_store_users_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_store_users
    ADD CONSTRAINT pdv_store_users_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.pdv_stores(id) ON DELETE CASCADE;


--
-- Name: pdv_support_settings pdv_support_settings_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdv_support_settings
    ADD CONSTRAINT pdv_support_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.pdv_stores(id) ON DELETE SET NULL;


--
-- Name: vendas vendas_comanda_numero_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT vendas_comanda_numero_fkey FOREIGN KEY (comanda_numero) REFERENCES public.comandas(numero) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--
