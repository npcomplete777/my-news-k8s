#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="anon-news"
CONTEXT="k3d-${CLUSTER_NAME}"
NAMESPACE="anon-news"

echo "=== Anonymous News Browsing — Cluster Setup ==="

# -------------------------------------------------------
# 1. Create k3d cluster (idempotent)
# -------------------------------------------------------
if k3d cluster list 2>/dev/null | grep -q "${CLUSTER_NAME}"; then
  echo "[OK] k3d cluster '${CLUSTER_NAME}' already exists — skipping creation."
else
  echo "[..] Creating k3d cluster '${CLUSTER_NAME}'..."
  k3d cluster create "${CLUSTER_NAME}" --agents 1 --wait
  echo "[OK] Cluster created."
fi

# -------------------------------------------------------
# 2. Set kubectl context
# -------------------------------------------------------
echo "[..] Setting kubectl context to '${CONTEXT}'..."
kubectl config use-context "${CONTEXT}"
echo "[OK] Context set."

# -------------------------------------------------------
# 3. Create anon-news namespace (idempotent)
# -------------------------------------------------------
if kubectl --context "${CONTEXT}" get namespace "${NAMESPACE}" >/dev/null 2>&1; then
  echo "[OK] Namespace '${NAMESPACE}' already exists."
else
  echo "[..] Creating namespace '${NAMESPACE}'..."
  kubectl --context "${CONTEXT}" create namespace "${NAMESPACE}"
  echo "[OK] Namespace created."
fi

# -------------------------------------------------------
# 4. Create argocd namespace (idempotent)
# -------------------------------------------------------
if kubectl --context "${CONTEXT}" get namespace argocd >/dev/null 2>&1; then
  echo "[OK] Namespace 'argocd' already exists."
else
  echo "[..] Creating namespace 'argocd'..."
  kubectl --context "${CONTEXT}" create namespace argocd
  echo "[OK] Namespace created."
fi

# -------------------------------------------------------
# 5. Install ArgoCD (idempotent — apply is safe to re-run)
# -------------------------------------------------------
echo "[..] Installing ArgoCD into 'argocd' namespace..."
kubectl --context "${CONTEXT}" apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
echo "[OK] ArgoCD manifests applied."

# -------------------------------------------------------
# 6. Wait for ArgoCD server to be ready
# -------------------------------------------------------
echo "[..] Waiting for ArgoCD server deployment to be ready (timeout 300s)..."
kubectl --context "${CONTEXT}" rollout status deployment/argocd-server -n argocd --timeout=300s
echo "[OK] ArgoCD server is ready."

# -------------------------------------------------------
# 7. Print ArgoCD initial admin password
# -------------------------------------------------------
echo ""
echo "=== ArgoCD Initial Admin Password ==="
ARGOCD_PASSWORD=$(kubectl --context "${CONTEXT}" -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "Username: admin"
echo "Password: ${ARGOCD_PASSWORD}"
echo ""
echo "To access the ArgoCD UI, run:"
echo "  kubectl --context ${CONTEXT} port-forward svc/argocd-server -n argocd 8443:443"
echo "Then open https://localhost:8443"
echo ""
echo "=== Setup Complete ==="
