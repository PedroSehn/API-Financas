-- USERS
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_demo       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- SALARY CONFIG
CREATE TABLE salary_config (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gross_salary    DECIMAL(10,2) NOT NULL,
  has_inss        BOOLEAN DEFAULT TRUE,
  has_irrf        BOOLEAN DEFAULT TRUE,
  vt_percentage   DECIMAL(5,2) DEFAULT 0,
  health_plan     DECIMAL(10,2) DEFAULT 0,
  other_discounts JSONB,
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- INCOMES
CREATE TABLE incomes (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(100) NOT NULL,
  emoji       VARCHAR(10),
  value       DECIMAL(10,2) NOT NULL,
  type        VARCHAR(20) NOT NULL, -- 'salary' | 'vr' | 'extra'
  start_month INT NOT NULL,
  start_year  INT NOT NULL,
  duration_months INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- EXPENSES
CREATE TABLE expenses (
  id              SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           VARCHAR(100) NOT NULL,
  emoji           VARCHAR(10),
  value           DECIMAL(10,2) NOT NULL,
  category        VARCHAR(50),
  start_month     INT NOT NULL,
  start_year      INT NOT NULL,
  duration_months INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- CREDIT CARDS
CREATE TABLE credit_cards (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  emoji      VARCHAR(10),
  color      VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- CARD TRANSACTIONS
CREATE TABLE card_transactions (
  id              SERIAL PRIMARY KEY,
  credit_card_id  INT NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  description     VARCHAR(150) NOT NULL,
  emoji           VARCHAR(10),
  value           DECIMAL(10,2) NOT NULL,
  date            DATE NOT NULL,
  start_month     INT NOT NULL,
  start_year      INT NOT NULL,
  duration_months INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT NOW()
);