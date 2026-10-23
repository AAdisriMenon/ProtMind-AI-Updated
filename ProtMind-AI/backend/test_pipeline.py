"""
ProtMind AI - Comprehensive Integration & Pipeline Test Suite
Tests:
1. Reordered Step 8 (Therapeutic Targeting) and Step 9 (Explainable AI)
2. Researcher-oriented Explainable AI with multi-evidence synthesis
3. Self-contained multi-page PDF generation with completeness check
4. Cross-mutation accuracy testing (never mixed or hardcoded)
"""

import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
import backend as bk
from api import app

client = TestClient(app)

TP53_PAYLOAD = {
    "uniprot_id": "P04637",
    "mutation": "R175H",
    "sequence": "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENLRKKGEPHHELPPGSTKRALPNNTSSSPQPKKKPLDGEYFTLQIRGRERFEMFRELNEALELKDAQAGKEPGGSRAHSSHLKSKKGQSTSRHKKLMFKTEGPDSD",
    "source": "UniProt Verified"
}

KRAS_PAYLOAD = {
    "uniprot_id": "P01116",
    "mutation": "G12D",
    "sequence": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIRKHKEKMSKDGKKKKKKSKTKCVIM",
    "source": "UniProt Verified"
}

BRAF_PAYLOAD = {
    "uniprot_id": "P15056",
    "mutation": "V600E",
    "sequence": "MAALSGGGGGGAEPGQALFNGDMEPEAGAGAGAAASSAADPAIPEEVWNIKQMIKLTQEHIEALLDKFGGEHNPPSIYLEYEDSKIKFLHRQIFQLELQLKEISENLAKR",
    "source": "UniProt Verified"
}

CONSERVATIVE_PAYLOAD = {
    "uniprot_id": "P04637",
    "mutation": "I50L",
    "sequence": "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGPDEAPRMPEAAPPVAPAPAAPTPAAPAPAPSWPLSSSVPSQKTYQGSYGFRLGFLHSGTAKSVTCTYSPALNKMFCQLAKTCPVQLWVDSTPPPGTRVRAMAIYKQSQHMTEVVRRCPHHERCSDSDGLAPPQHLIRVEGNLRVEYLDDRNTFRHSVVVPYEPPEVGSDCTTIHYNYMCNSSCMGGMNRRPILTIITLEDSSGNLLGRNSFEVRVCACPGRDRRTEEENLRKKGEPHHELPPGSTKRALPNNTSSSPQPKKKPLDGEYFTLQIRGRERFEMFRELNEALELKDAQAGKEPGGSRAHSSHLKSKKGQSTSRHKKLMFKTEGPDSD",
    "source": "UniProt Verified"
}


def test_step8_therapeutic_targeting():
    """Verify Step 8 serves Therapeutic Targeting via ChEMBL."""
    res = client.post("/api/step8", json=TP53_PAYLOAD)
    assert res.status_code == 200, f"Step 8 failed: {res.text}"
    data = res.json()
    assert "gene" in data
    assert "drugs" in data
    assert isinstance(data["drugs"], list)
    assert len(data["drugs"]) > 0
    first_drug = data["drugs"][0]
    assert "Molecule ID" in first_drug
    assert "Action Type" in first_drug
    assert "Mechanism" in first_drug
    print("[PASS] Step 8 (Therapeutic Targeting) returned valid ChEMBL drugs.")


def test_step9_explainable_ai():
    """Verify Step 9 serves researcher-oriented Explainable AI."""
    res = client.post("/api/step9", json=TP53_PAYLOAD)
    assert res.status_code == 200, f"Step 9 failed: {res.text}"
    xai = res.json()
    assert "verdict" in xai
    assert "confidence" in xai
    assert "confidence_score" in xai
    assert "primary_mechanism" in xai
    assert "summary_narrative" in xai
    assert "workflow_trace" in xai
    assert len(xai["workflow_trace"]) == 8
    assert "evidence_matrix" in xai
    assert len(xai["evidence_matrix"]) >= 5
    assert "supporting_evidence" in xai
    assert "conflicting_evidence" in xai
    assert "uncertainties_and_limitations" in xai
    assert "recommended_follow_ups" in xai
    print(f"[PASS] Step 9 (Explainable AI) returned consensus verdict: {xai['verdict']} ({xai['confidence']}).")


def test_step10_comprehensive_pdf():
    """Verify Step 10 generates self-contained multi-page PDF report."""
    res = client.post("/api/step10/pdf", json=TP53_PAYLOAD)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    pdf_content = res.content
    assert pdf_content.startswith(b"%PDF-"), "Output must be valid PDF header"
    assert len(pdf_content) > 20000, f"Report must be comprehensive (>20KB), got {len(pdf_content)} bytes"
    print(f"[PASS] Step 10 (PDF Report) generated successfully: {len(pdf_content)} bytes.")


def test_cross_mutation_distinction():
    """Verify mutations are dynamically calculated and never mixed or hardcoded."""
    xai_p53 = bk.generate_explainable_ai(TP53_PAYLOAD)
    xai_kras = bk.generate_explainable_ai(KRAS_PAYLOAD)
    xai_cons = bk.generate_explainable_ai(CONSERVATIVE_PAYLOAD)

    # 1. Target and residue differences
    assert xai_p53["gene"] != xai_kras["gene"], "Genes must be distinct"
    assert xai_p53["mutation"] == "R175H"
    assert xai_kras["mutation"] == "G12D"
    assert xai_cons["mutation"] == "I50L"

    # 2. Conservation differences
    b_p53 = xai_p53["conservation_evidence"]["blosum62_score"]
    b_kras = xai_kras["conservation_evidence"]["blosum62_score"]
    b_cons = xai_cons["conservation_evidence"]["blosum62_score"]
    assert b_p53 != b_cons, "Conservative mutation must have distinct BLOSUM62 score"
    assert b_cons > 0, f"Conservative I50L should have positive BLOSUM score, got {b_cons}"

    # 3. Thermodynamic differences
    ddg_p53 = xai_p53["structural_stability_evidence"]["ddG"]
    ddg_kras = xai_kras["structural_stability_evidence"]["ddG"]
    ddg_cons = xai_cons["structural_stability_evidence"]["ddG"]
    print(f"  Delta-Delta-G R175H: {ddg_p53} kcal/mol | Delta-Delta-G G12D: {ddg_kras} kcal/mol | Delta-Delta-G I50L: {ddg_cons} kcal/mol")
    assert ddg_p53 != ddg_cons, "ΔΔG must be dynamically computed"

    # 4. Predictor differences
    assert xai_cons["conservation_evidence"]["sift"]["prediction"] == "Tolerated"
    assert xai_kras["conservation_evidence"]["sift"]["prediction"] == "Deleterious"

    print("[PASS] Cross-mutation dynamic distinction verified across multiple targets.")


def test_backward_compatibility_aliases():
    """Verify legacy aliases remain functional."""
    r1 = client.post("/api/step8/drugs", json=TP53_PAYLOAD)
    assert r1.status_code == 200
    r2 = client.post("/api/step9/drugs", json=TP53_PAYLOAD)
    assert r2.status_code == 200
    r3 = client.post("/api/step9/explain", json=TP53_PAYLOAD)
    assert r3.status_code == 200
    print("[PASS] Backward-compatibility aliases verified.")


if __name__ == "__main__":
    print("\n--- Running ProtMind AI Verification Tests ---", flush=True)
    test_step8_therapeutic_targeting()
    test_step9_explainable_ai()
    test_step10_comprehensive_pdf()
    test_cross_mutation_distinction()
    test_backward_compatibility_aliases()
    print("\n✅ All integration tests PASSED successfully!\n", flush=True)
