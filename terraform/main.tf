# ---------------------------------------------------------------------------
# GKE Standard cluster for The Self-Observing Observatory
#
# Design choices driven by cost constraints (<$20/month):
#   - GKE Standard (zonal): free tier covers $74.40/month management fee
#   - Single e2-small spot node: ~$6/month vs $13/month on-demand
#   - Single zone (us-central1-a): no cross-zone traffic costs
#   - Private cluster with authorized networks: security (SG-S3)
#   - Workload Identity: no service account key files
# ---------------------------------------------------------------------------

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "container.googleapis.com",
    "compute.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# ---------------------------------------------------------------------------
# VPC + Subnet
# ---------------------------------------------------------------------------
resource "google_compute_network" "vpc" {
  name                    = var.network_name
  project                 = var.project_id
  auto_create_subnetworks = false

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "subnet" {
  name          = var.subnet_name
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.subnet_cidr

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr
  }

  private_ip_google_access = true
}

# Allow internal traffic + health checks from GCP load balancers
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.cluster_name}-allow-internal"
  project = var.project_id
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = [var.subnet_cidr, var.pods_cidr, var.services_cidr]
}

resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.cluster_name}-allow-health-checks"
  project = var.project_id
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
  }

  # GCP health check probe ranges
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
}

# ---------------------------------------------------------------------------
# Cloud Router + NAT (for private nodes to reach external APIs)
# ---------------------------------------------------------------------------
resource "google_compute_router" "router" {
  name    = "${var.cluster_name}-router"
  project = var.project_id
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${var.cluster_name}-nat"
  project                            = var.project_id
  region                             = var.region
  router                             = google_compute_router.router.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = false
    filter = "ERRORS_ONLY"
  }
}

# ---------------------------------------------------------------------------
# GKE Standard Cluster (zonal — free tier covers management fee)
# ---------------------------------------------------------------------------
resource "google_container_cluster" "primary" {
  name     = var.cluster_name
  project  = var.project_id
  location = "${var.region}-a" # Single zone for free tier

  # Standard mode — we manage node pools
  initial_node_count       = 1
  remove_default_node_pool = true

  network    = google_compute_network.vpc.id
  subnetwork = google_compute_subnetwork.subnet.id

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  release_channel {
    channel = var.release_channel
  }

  # Private cluster — nodes have no public IPs
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  master_authorized_networks_config {
    cidr_blocks {
      cidr_block   = var.master_authorized_cidr
      display_name = "authorized-access"
    }
  }

  # Workload Identity for secure pod-to-GCP auth
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  deletion_protection = false

  depends_on = [
    google_project_service.apis,
    google_compute_subnetwork.subnet,
  ]
}

# ---------------------------------------------------------------------------
# Node Pool — single e2-small spot instance
# ---------------------------------------------------------------------------
resource "google_container_node_pool" "primary_nodes" {
  name     = "${var.cluster_name}-pool"
  project  = var.project_id
  location = "${var.region}-a"
  cluster  = google_container_cluster.primary.name

  node_count = 1

  node_config {
    machine_type = "e2-small" # 2 vCPU, 2GB RAM
    spot         = true       # ~50% cheaper than on-demand

    disk_size_gb = 30
    disk_type    = "pd-standard"

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# ---------------------------------------------------------------------------
# Artifact Registry for container images
# ---------------------------------------------------------------------------
resource "google_artifact_registry_repository" "images" {
  location      = var.region
  project       = var.project_id
  repository_id = "anon-news"
  description   = "Container images for The Self-Observing Observatory"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.apis]
}
