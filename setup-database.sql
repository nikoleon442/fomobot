-- FOMObot Database Setup
-- This script creates the required tables for the FOMObot service

-- Create tokens_fsm table (FSM group tokens)
CREATE TABLE IF NOT EXISTS tokens_fsm (
  id bigint PRIMARY KEY,
  token_address varchar NOT NULL,
  symbol varchar NOT NULL,
  initial_market_cap_usd numeric NOT NULL,
  first_called_at_utc timestamptz NOT NULL,
  posted_message_id varchar,
  peak_market_cap_usd numeric,
  peak_timestamp timestamptz,
  max_percentage_profit numeric,
  multiple numeric,
  time_to_peak interval,
  time_to_peak_formatted text
);

-- Create tokens_issam table (Issam group tokens)
CREATE TABLE IF NOT EXISTS tokens_issam (
  id bigint PRIMARY KEY,
  token_address varchar NOT NULL,
  symbol varchar NOT NULL,
  initial_market_cap_usd numeric NOT NULL,
  first_called_at_utc timestamptz NOT NULL,
  posted_message_id varchar,
  peak_market_cap_usd numeric,
  peak_timestamp timestamptz,
  max_percentage_profit numeric,
  multiple numeric,
  time_to_peak interval,
  time_to_peak_formatted text
);

-- Create milestones_config table for dynamic milestone configuration
CREATE TABLE IF NOT EXISTS milestones_config (
  id bigserial PRIMARY KEY,
  group_name varchar NOT NULL CHECK (group_name IN ('fsm', 'issam')),
  milestone_value numeric NOT NULL,
  milestone_label varchar NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at_utc timestamptz NOT NULL DEFAULT NOW(),
  updated_at_utc timestamptz NOT NULL DEFAULT NOW(),
  created_by varchar,
  notes text,
  UNIQUE(group_name, milestone_value)
);

-- Create milestone_notifications table to track sent notifications
CREATE TABLE IF NOT EXISTS milestone_notifications (
  id bigserial PRIMARY KEY,
  token_id bigint NOT NULL,
  token_address varchar NOT NULL,
  group_name varchar NOT NULL CHECK (group_name IN ('fsm', 'issam')),
  milestone_value numeric NOT NULL,
  milestone_label varchar NOT NULL,
  notified_at_utc timestamptz NOT NULL DEFAULT NOW(),
  message_id varchar,
  UNIQUE(token_id, milestone_value)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tokens_fsm_token_address ON tokens_fsm(token_address);
CREATE INDEX IF NOT EXISTS idx_tokens_fsm_first_called_at ON tokens_fsm(first_called_at_utc);
CREATE INDEX IF NOT EXISTS idx_tokens_issam_token_address ON tokens_issam(token_address);
CREATE INDEX IF NOT EXISTS idx_tokens_issam_first_called_at ON tokens_issam(first_called_at_utc);
CREATE INDEX IF NOT EXISTS idx_milestones_config_group ON milestones_config(group_name);
CREATE INDEX IF NOT EXISTS idx_milestones_config_active ON milestones_config(is_active);
CREATE INDEX IF NOT EXISTS idx_milestone_notifications_token_id ON milestone_notifications(token_id);
CREATE INDEX IF NOT EXISTS idx_milestone_notifications_group ON milestone_notifications(group_name);
CREATE INDEX IF NOT EXISTS idx_milestone_notifications_notified_at ON milestone_notifications(notified_at_utc);

-- Insert some sample data for testing (you can remove this later)
INSERT INTO tokens_fsm (id, token_address, symbol, initial_market_cap_usd, first_called_at_utc) 
VALUES 
  (1, 'So11111111111111111111111111111111111111112', 'SOL', 1000000, NOW()),
  (2, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 500000, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO tokens_issam (id, token_address, symbol, initial_market_cap_usd, first_called_at_utc) 
VALUES 
  (1, 'So11111111111111111111111111111111111111112', 'SOL', 1000000, NOW()),
  (2, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC', 500000, NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample milestone configurations
INSERT INTO milestones_config (group_name, milestone_value, milestone_label, created_by, notes) VALUES
-- FSM group milestones (more aggressive)
('fsm', 2.0, '2×', 'admin', '2x initial market cap'),
('fsm', 3.0, '3×', 'admin', '3x initial market cap'),
('fsm', 5.0, '5×', 'admin', '5x initial market cap'),
('fsm', 10.0, '10×', 'admin', '10x initial market cap'),
-- Issam group milestones (more conservative)
('issam', 1.5, '1.5×', 'admin', '1.5x initial market cap'),
('issam', 2.0, '2×', 'admin', '2x initial market cap'),
('issam', 3.0, '3×', 'admin', '3x initial market cap'),
('issam', 5.0, '5×', 'admin', '5x initial market cap')
ON CONFLICT (group_name, milestone_value) DO NOTHING;
