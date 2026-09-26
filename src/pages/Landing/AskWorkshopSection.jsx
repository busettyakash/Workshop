import React from "react"
import { Link } from "react-router"
import {
  FileText,
  Building2,
  MapPin,
  Tag,
  BarChart3,
  CheckCircle2,
  Search,
  Bot,
  Sparkles,
  Receipt
} from "lucide-react"

export default function AskWorkshopSection() {
  const rows = [
    {
      icon: <FileText size={11} />,
      label: "GSTIN",
      value: <span style={{ color: "#2563eb", fontFamily: "monospace", fontSize: "0.72rem", fontWeight: 700 }}>36AAACR1234F1Z5</span>,
    },
    {
      icon: <Building2 size={11} />,
      label: "Business",
      value: "Sri Venkateswara",
    },
    {
      icon: <Receipt size={11} />,
      label: "Status",
      value: (
        <span style={{ background: "#dcfce7", color: "#166534", padding: "1px 7px", borderRadius: "999px", fontSize: "0.68rem", fontWeight: 700 }}>
          Active · Verified
        </span>
      ),
    },
    {
      icon: <MapPin size={11} />,
      label: "Location",
      value: "Hyderabad, India",
    },
    {
      icon: <Tag size={11} />,
      label: "Category",
      value: (
        <span style={{ display: "flex", gap: "3px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 600 }}>Wholesale</span>
          <span style={{ background: "#f0fdf4", color: "#15803d", padding: "1px 6px", borderRadius: "999px", fontSize: "0.65rem", fontWeight: 600 }}>Retail</span>
        </span>
      ),
    },
    {
      icon: <BarChart3 size={11} />,
      label: "Total Billed",
      value: "₹48.6L this year",
    },
    {
      icon: <CheckCircle2 size={11} />,
      label: "Ledger",
      value: <span style={{ color: "#16a34a", fontWeight: 600 }}>₹0 Balance (Paid)</span>,
    },
  ]

  return (
    <div className="cds-split">

      {/* ── LEFT ── */}
      <div className="cds-left">
        <div className="cds-left-top">
          <h2 className="cds-heading">AI-Powered Operations</h2>
          <p className="cds-sub">
            Ask Workshop automates GST tax calculations, verifies live stock availability, checks customer ledger balances, and creates quotations instantly.
          </p>
        </div>
        <Link to="/signup" className="cds-link" style={{ textDecoration: "none" }}>Explore AI features →</Link>
      </div>

      {/* ── CENTER — Real Retail AI Decision Tree ── */}
      <div className="cds-center" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="ws-ai-tree">
          <div className="ws-ai-trigger">
            <Search size={14} className="ws-ai-trigger-icon" />
            <span>New order request found</span>
          </div>

          <div className="ws-ai-trunk">
            {[
              {
                title: "Automated GST Calculation",
                question: "What is the tax breakdown for this order?",
                answer: <>18% GST (<span className="ws-ai-purple-text">9% CGST + 9% SGST</span>) applied · Taxable: ₹46,000</>,
              },
              {
                title: "Live Inventory & Stock Check",
                question: "Is there sufficient stock in warehouse?",
                answer: <><span className="ws-ai-purple-text">120 Bags (50kg)</span> in stock · 50 Bags auto-reserved</>,
              },
              {
                title: "Customer Ledger & Credit Check",
                question: "What is the customer's outstanding balance?",
                answer: <><span className="ws-ai-purple-text">₹0 outstanding</span> · Previous invoice INV-10482 paid</>,
              },
            ].map(({ title, question, answer }) => (
              <div key={title} className="ws-ai-branch">
                <div className="ws-ai-branch-line" />
                <div className="ws-ai-node-content">
                  <div className="ws-ai-card">
                    <div className="ws-ai-card-top">
                      <div className="ws-ai-bot-icon"><Bot size={14} /></div>
                      <span className="ws-ai-card-title">{title}</span>
                      <span className="ws-ai-card-badge">AI</span>
                    </div>
                    <div className="ws-ai-card-question">{question}</div>
                  </div>
                  <div className="ws-ai-answer-pill">
                    <Sparkles size={12} className="ws-ai-sparkle-icon" />
                    <span>{answer}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT — Real Verified Customer & Business Profile Card ── */}
      <div
        className="cds-right"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          padding: "28px 16px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "244px",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 14px",
              borderBottom: "1px solid #f0f0f0",
              background: "#fafafa",
            }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "#1e3a8a",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                fontWeight: 800,
                flexShrink: 0,
                letterSpacing: "0.02em",
              }}
            >
              SV
            </div>
            <div>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", display: "block", lineHeight: 1.2 }}>
                Sri Venkateswara
              </span>
              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                Wholesale Buyer
              </span>
            </div>
          </div>

          {/* Rows */}
          <div style={{ padding: "8px 0" }}>
            {rows.map(({ icon, label, value }) => (
              <div
                key={label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "82px 1fr",
                  alignItems: "center",
                  columnGap: "6px",
                  padding: "6px 14px",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "0.69rem",
                    color: "#64748b",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: "#94a3b8", flexShrink: 0 }}>{icon}</span>
                  {label}
                </span>

                <span
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 500,
                    color: "#0f172a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    textAlign: "right",
                    minWidth: 0,
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}