import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  header: { marginBottom: 20, borderBottom: "2px solid #1a1a1a", paddingBottom: 10 },
  companyName: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  coaTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 8, textAlign: "center" },
  coaNumber: { fontSize: 10, color: "#555", textAlign: "center", marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6, backgroundColor: "#f0f0f0", padding: "4 6" },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: "35%", fontFamily: "Helvetica-Bold", color: "#444" },
  value: { width: "65%" },
  table: { border: "1px solid #ccc", marginBottom: 10 },
  tableHeader: { flexDirection: "row", backgroundColor: "#1a1a1a", padding: "5 6" },
  tableHeaderCell: { color: "white", fontFamily: "Helvetica-Bold", flex: 1, fontSize: 9 },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #eee", padding: "4 6" },
  tableRowAlt: { flexDirection: "row", backgroundColor: "#f9f9f9", borderBottom: "1px solid #eee", padding: "4 6" },
  tableCell: { flex: 1, fontSize: 9 },
  tableCellBold: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold" },
  passCell: { flex: 1, fontSize: 9, color: "#16a34a", fontFamily: "Helvetica-Bold" },
  failCell: { flex: 1, fontSize: 9, color: "#dc2626", fontFamily: "Helvetica-Bold" },
  determination: { marginTop: 10, padding: 10, border: "1px solid #ccc", backgroundColor: "#f9f9f9" },
  determinationText: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center" },
  signatureSection: { flexDirection: "row", marginTop: 20, gap: 20 },
  signatureBox: { flex: 1, borderTop: "1px solid #333", paddingTop: 4 },
  signatureLabel: { fontSize: 9, color: "#666" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTop: "1px solid #ccc", paddingTop: 6, fontSize: 8, color: "#999", textAlign: "center" },
});

interface COAResult {
  parameterName: string;
  unit?: string;
  value: string;
  parameterType?: string;
  minValue?: number;
  maxValue?: number;
  isWithinSpec?: boolean;
  isFlagged?: boolean;
}

interface COAData {
  coaNumber: string;
  lotNumber: string;
  customerName?: string;
  customerPoNumber?: string;
  materialType?: string;
  issuedAt: string;
  generatedByName?: string;
  results: COAResult[];
  overallResult?: string;
}

export function CoaPdfDocument({ data }: { data: COAData }) {
  const formatSpec = (r: COAResult) => {
    if (r.minValue != null && r.maxValue != null) return `${r.minValue} – ${r.maxValue}`;
    if (r.minValue != null) return `≥ ${r.minValue}`;
    if (r.maxValue != null) return `≤ ${r.maxValue}`;
    return "—";
  };

  const isPassed = data.overallResult === "PASS";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>PlantOps</Text>
          <Text style={styles.coaTitle}>CERTIFICATE OF ANALYSIS</Text>
          <Text style={styles.coaNumber}>COA #{data.coaNumber}</Text>
        </View>

        {/* Lot Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LOT INFORMATION</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Lot Number:</Text>
            <Text style={styles.value}>{data.lotNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Material Type:</Text>
            <Text style={styles.value}>{data.materialType || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Customer:</Text>
            <Text style={styles.value}>{data.customerName || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Customer PO:</Text>
            <Text style={styles.value}>{data.customerPoNumber || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Issue Date:</Text>
            <Text style={styles.value}>{new Date(data.issuedAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Test Results */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TEST RESULTS</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Parameter</Text>
              <Text style={styles.tableHeaderCell}>Unit</Text>
              <Text style={styles.tableHeaderCell}>Result</Text>
              <Text style={styles.tableHeaderCell}>Specification</Text>
              <Text style={styles.tableHeaderCell}>Status</Text>
            </View>
            {data.results.filter(r => r.parameterType !== "photo").map((r, i) => {
              const rowStyle = i % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
              const statusStyle = r.isFlagged ? styles.failCell : styles.passCell;
              const statusText = r.isFlagged ? "FAIL" : r.isWithinSpec === false ? "OOS" : "PASS";
              return (
                <View key={i} style={rowStyle}>
                  <Text style={[styles.tableCellBold, { flex: 2 }]}>{r.parameterName}</Text>
                  <Text style={styles.tableCell}>{r.unit || "—"}</Text>
                  <Text style={styles.tableCell}>{r.value}</Text>
                  <Text style={styles.tableCell}>{formatSpec(r)}</Text>
                  <Text style={statusStyle}>{statusText}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Determination */}
        <View style={styles.determination}>
          <Text style={styles.determinationText}>
            DETERMINATION: {isPassed ? "✓ APPROVED — MEETS SPECIFICATIONS" : "✗ NON-CONFORMING — DOES NOT MEET SPECIFICATIONS"}
          </Text>
        </View>

        {/* Inspection Photos */}
        {data.results.some(r => r.parameterType === "photo" && r.value) && (
          <View style={[styles.section, { marginTop: 14 }]}>
            <Text style={styles.sectionTitle}>INSPECTION PHOTOS</Text>
            {data.results.filter(r => r.parameterType === "photo" && r.value).map((r, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{r.parameterName}</Text>
                <Image src={r.value} style={{ maxHeight: 160, objectFit: "contain" }} />
              </View>
            ))}
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Quality Manager Signature</Text>
            <Text style={styles.signatureLabel}>{data.generatedByName || ""}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Date</Text>
            <Text style={styles.signatureLabel}>{new Date(data.issuedAt).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This certificate is issued based on results of testing performed at the time of production. PlantOps — COA #{data.coaNumber}
        </Text>
      </Page>
    </Document>
  );
}
