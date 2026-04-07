const monthFilter = (yearParam, monthParam) => ({
    sql: `
    (start_year * 12 + start_month) <= (${yearParam} * 12 + ${monthParam})
    AND (start_year * 12 + start_month + duration_months - 1) >= (${yearParam} * 12 + ${monthParam})
  `
});

module.exports = { monthFilter };