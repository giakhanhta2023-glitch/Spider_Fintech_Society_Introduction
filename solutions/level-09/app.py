"""
app.py: the Loan Advisor interface.

Interface only: every number on this page comes from finance.py. If you find
yourself writing a formula in this file, it belongs in the other one.

Run:  streamlit run app.py
"""

import pandas as pd
import streamlit as st

from finance import (affordability, compare_terms, invest_instead,
                     monthly_payment, overpayment_saving, schedule, summarise)

st.set_page_config(page_title="Loan Advisor", page_icon="\U0001F4B0", layout="wide")

st.title("Loan Advisor")
st.caption("Built for the Spider Fintech Society. Educational tool, not financial advice.")


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------
with st.sidebar:
    st.header("Your loan")
    principal = st.number_input("Amount borrowed", min_value=1_000.0, max_value=5_000_000.0,
                                value=250_000.0, step=1_000.0, format="%.0f")
    rate_pct = st.slider("Interest rate (%)", 0.0, 25.0, 5.5, 0.1)
    years = st.slider("Term (years)", 1, 40, 30)
    extra = st.number_input("Extra monthly payment", min_value=0.0, max_value=50_000.0,
                            value=0.0, step=50.0, format="%.0f")

    st.header("Affordability")
    income = st.number_input("Gross monthly income", min_value=0.0, value=6_000.0, step=250.0,
                             format="%.0f")
    other_debts = st.number_input("Other monthly debt payments", min_value=0.0, value=250.0,
                                  step=50.0, format="%.0f")
    asset_value = st.number_input("Property value (0 to skip LTV)", min_value=0.0,
                                  value=312_500.0, step=5_000.0, format="%.0f")

    st.header("Comparison")
    invest_rate_pct = st.slider("Assumed investment return (%)", 0.0, 15.0, 7.0, 0.5)

rate = rate_pct / 100
invest_rate = invest_rate_pct / 100


# ---------------------------------------------------------------------------
# Validation, every failure is a sentence, never a traceback
# ---------------------------------------------------------------------------
@st.cache_data(ttl=3600)
def build_schedule(principal, rate, years, extra):
    """Cached because Streamlit re-runs this whole script on every slider move,
    and a 40-year schedule is 480 rows of work each time."""
    return schedule(principal, rate, years, extra=extra)


try:
    base_rows = build_schedule(principal, rate, years, 0.0)
    fast_rows = build_schedule(principal, rate, years, extra) if extra else base_rows
except ValueError as err:
    st.error(str(err))
    st.stop()

if income <= 0:
    st.error("Monthly income must be greater than zero to assess affordability.")
    st.stop()

payment = base_rows[0]["payment"]
if extra > payment * 3:
    st.warning(f"An extra payment of {extra:,.0f} is more than three times the scheduled "
               f"payment of {payment:,.2f}. Check that is what you meant.")

base = summarise(base_rows)
fast = summarise(fast_rows)


# ---------------------------------------------------------------------------
# Headline
# ---------------------------------------------------------------------------
col1, col2, col3, col4 = st.columns(4)
col1.metric("Monthly payment", f"${payment:,.2f}",
            delta=f"+${extra:,.0f} extra" if extra else None)
col2.metric("Total interest", f"${base['total_interest']:,.0f}",
            delta=f"-${base['total_interest'] - fast['total_interest']:,.0f}" if extra else None,
            delta_color="inverse" if extra else "off")
col3.metric("Months to clear", fast["months"],
            delta=f"{fast['months'] - base['months']}" if extra else None,
            delta_color="inverse" if extra else "off")
col4.metric("Interest as % of repayments", f"{fast['interest_share']:.0%}")

st.caption(f"Month 1 puts {base['first_principal_share']:.1%} of your payment against the debt. "
           f"Principal overtakes interest in month {base['crossover_month']}.")


# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------
tab_balance, tab_split, tab_terms, tab_schedule, tab_afford = st.tabs(
    ["Balance", "Where the money goes", "Term comparison", "Full schedule", "Affordability"])

with tab_balance:
    chart = pd.DataFrame({"standard": [r["balance"] for r in base_rows]})
    if extra:
        padded = [r["balance"] for r in fast_rows] + [0.0] * (len(base_rows) - len(fast_rows))
        chart["with extra payment"] = padded
    chart.index = range(1, len(chart) + 1)
    chart.index.name = "month"
    st.line_chart(chart)
    if extra:
        saving = overpayment_saving(principal, rate, years, extra)
        st.success(f"Paying an extra ${extra:,.0f} a month clears the loan "
                   f"{saving['months_saved'] // 12} years {saving['months_saved'] % 12} months early "
                   f"and removes ${saving['interest_saved']:,.0f} of interest.")
        future = invest_instead(extra, invest_rate, years)
        st.info(f"Investing that ${extra:,.0f} a month at {invest_rate:.1%} instead would be worth "
                f"about ${future:,.0f} after {years} years. Overpaying returns a guaranteed "
                f"{rate:.2%}; the market return is uncertain and much harder to reach in an emergency.")

with tab_split:
    split = pd.DataFrame({
        "interest": [r["interest"] for r in base_rows],
        "principal": [r["principal"] for r in base_rows],
    })
    split.index = range(1, len(split) + 1)
    split.index.name = "month"
    st.line_chart(split)
    st.caption("Early payments are mostly interest because interest is charged on the outstanding "
               "balance. As the balance falls, the same payment buys more principal.")

with tab_terms:
    terms = pd.DataFrame(compare_terms(principal, rate))
    terms.columns = ["Term (years)", "Monthly payment", "Total paid", "Total interest"]
    st.dataframe(terms, use_container_width=True, hide_index=True)
    st.caption("A shorter term costs more each month and far less overall.")

with tab_schedule:
    table = pd.DataFrame(fast_rows)
    st.dataframe(table, use_container_width=True, hide_index=True, height=420)
    st.download_button("Download schedule (CSV)",
                       table.to_csv(index=False).encode("utf-8"),
                       file_name="amortization-schedule.csv", mime="text/csv")

with tab_afford:
    try:
        assessment = affordability(payment + extra, other_debts, income,
                                   loan=principal, asset_value=asset_value or None)
    except ValueError as err:
        st.error(str(err))
    else:
        left, right = st.columns(2)
        left.metric("Debt-to-income", f"{assessment['dti']:.1%}", assessment["band"],
                    delta_color="off")
        if assessment["ltv"] is not None:
            right.metric("Loan-to-value", f"{assessment['ltv']:.1%}")
        st.progress(min(assessment["dti"] / 0.5, 1.0))
        st.caption("Under 36% is usually treated as comfortable and over 43% as high risk. "
                   "These are lending conventions, not legal limits, and every lender sets its own.")

st.divider()
st.caption("All calculations run in finance.py, which imports no UI library and is covered by "
           "22 tests. Educational use only. This is not financial advice.")
