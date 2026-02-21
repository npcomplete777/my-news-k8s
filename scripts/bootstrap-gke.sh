#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# bootstrap-gke.sh — Bootstrap a fresh GKE Standard cluster
#
# Installs: nginx-ingress, ArgoCD, Dash0 Operator, then applies the
# ArgoCD Application to deploy the app via GitOps.
#
# Prerequisites:
#   - gcloud CLI authenticated with project access
#   - kubectl configured (run: gcloud container clusters get-credentials ...)
#   - helm v3 installed
#   - DASH0_AUTH_TOKEN env var set (Dash0 API token)
#
# Target: < 15 min cold start (SG-M2)
# ---------------------------------------------------------------------------

NAMESPACE_APP="anon-news"
NAMESPACE_DASH0="dash0-system"
NAMESPACE_ARGOCD="argocd"
NAMESPACE_INGRESS="ingress-nginx"
DASH0_AUTH_TOKEN="${DASH0_AUTH_TOKEN:-}"

echo "============================================="
echo " The Self-Observing Observatory"
echo " GKE Cluster Bootstrap"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# Preflight checks
# ---------------------------------------------------------------------------
echo "[1/7] Preflight checks..."

for cmd in kubectl helm gcloud; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found. Install it and retry." >&2
    exit 1
  fi
done

CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || true)
if [[ -z "$CURRENT_CONTEXT" ]]; then
  echo "ERROR: No kubectl context set. Run:" >&2
  echo "  gcloud container clusters get-credentials anon-news --region us-central1" >&2
  exit 1
fi
echo "  kubectl context: ${CURRENT_CONTEXT}"

if [[ -z "$DASH0_AUTH_TOKEN" ]]; then
  echo "WARNING: DASH0_AUTH_TOKEN not set. Dash0 monitoring will not be configured."
  echo "  Set it and re-run, or manually create the secret later."
fi

echo "[OK] Preflight passed."
echo ""

# ---------------------------------------------------------------------------
# Create namespaces
# ---------------------------------------------------------------------------
echo "[2/7] Creating namespaces..."

for ns in "$NAMESPACE_APP" "$NAMESPACE_DASH0" "$NAMESPACE_ARGOCD" "$NAMESPACE_INGRESS"; do
  kubectl get namespace "$ns" &>/dev/null 2>&1 || kubectl create namespace "$ns"
  echo "  namespace/$ns ready"
done

echo "[OK] Namespaces created."
echo ""

# ---------------------------------------------------------------------------
# Install nginx-ingress controller
# ---------------------------------------------------------------------------
echo "[3/7] Installing nginx-ingress controller..."

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
helm repo update ingress-nginx

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace "$NAMESPACE_INGRESS" \
  --set controller.replicaCount=1 \
  --set controller.resources.requests.cpu=100m \
  --set controller.resources.requests.memory=128Mi \
  --set controller.service.externalTrafficPolicy=Local \
  --set controller.config.use-proxy-protocol="false" \
  --set controller.config.proxy-buffering="off" \
  --wait --timeout 300s

echo "[OK] nginx-ingress installed."
echo ""

# ---------------------------------------------------------------------------
# Install ArgoCD
# ---------------------------------------------------------------------------
echo "[4/7] Installing ArgoCD..."

kubectl apply -n "$NAMESPACE_ARGOCD" \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

echo "  Waiting for ArgoCD server to be ready..."
kubectl rollout status deployment/argocd-server -n "$NAMESPACE_ARGOCD" --timeout=300s

ARGOCD_PASSWORD=$(kubectl -n "$NAMESPACE_ARGOCD" get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" 2>/dev/null | base64 -d || echo "N/A")

echo "[OK] ArgoCD installed."
echo "  Admin password: ${ARGOCD_PASSWORD}"
echo ""

# ---------------------------------------------------------------------------
# Install Dash0 Operator
# ---------------------------------------------------------------------------
echo "[5/7] Installing Dash0 Kubernetes Operator..."

helm repo add dash0 https://helm.dash0.com 2>/dev/null || true
helm repo update dash0

DASH0_HELM_ARGS=(
  --namespace "$NAMESPACE_DASH0"
  --set operator.dash0Export.enabled=true
  --set operator.dash0Export.dash0.apiEndpoint=https://ingress.eu-west-1.aws.dash0.com
)

if [[ -n "$DASH0_AUTH_TOKEN" ]]; then
  DASH0_HELM_ARGS+=(--set operator.dash0Export.dash0.authorization.token="$DASH0_AUTH_TOKEN")
fi

helm upgrade --install dash0-operator dash0/dash0-operator \
  "${DASH0_HELM_ARGS[@]}" \
  --wait --timeout 300s

echo "[OK] Dash0 Operator installed."
echo ""

# ---------------------------------------------------------------------------
# Apply ArgoCD Application (triggers GitOps sync of the app)
# ---------------------------------------------------------------------------
echo "[6/7] Applying ArgoCD Application manifest..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARGOCD_DIR="${SCRIPT_DIR}/../argocd"

if [[ -f "${ARGOCD_DIR}/application.yaml" ]]; then
  kubectl apply -f "${ARGOCD_DIR}/application.yaml"
  echo "[OK] ArgoCD Application 'anon-news' applied. ArgoCD will sync the Helm chart."
else
  echo "WARNING: argocd/application.yaml not found at ${ARGOCD_DIR}/application.yaml"
  echo "  Apply it manually: kubectl apply -f argocd/application.yaml"
fi

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "[7/7] Bootstrap complete!"
echo ""
echo "============================================="
echo " Next Steps"
echo "============================================="
echo ""
echo "1. Get the ingress external IP:"
echo "   kubectl get svc -n ${NAMESPACE_INGRESS} ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'"
echo ""
echo "2. Point your DNS/Cloudflare to that IP"
echo ""
echo "3. Access ArgoCD UI:"
echo "   kubectl port-forward svc/argocd-server -n ${NAMESPACE_ARGOCD} 8443:443"
echo "   open https://localhost:8443  (admin / ${ARGOCD_PASSWORD})"
echo ""
echo "4. ArgoCD will auto-sync the app from GitHub. Watch progress:"
echo "   kubectl get app anon-news -n ${NAMESPACE_ARGOCD} -w"
echo ""
echo "5. If DASH0_AUTH_TOKEN was not set, create the Dash0 auth secret:"
echo "   kubectl create secret generic dash0-auth -n ${NAMESPACE_APP} --from-literal=token=YOUR_TOKEN"
echo ""
echo "============================================="
