variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the cluster"
  type        = string
  default     = "us-central1"
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
  default     = "anon-news"
}

variable "network_name" {
  description = "VPC network name"
  type        = string
  default     = "anon-news-vpc"
}

variable "subnet_name" {
  description = "Subnet name"
  type        = string
  default     = "anon-news-subnet"
}

variable "subnet_cidr" {
  description = "Primary CIDR for the subnet"
  type        = string
  default     = "10.0.0.0/20"
}

variable "pods_cidr" {
  description = "Secondary CIDR for pods"
  type        = string
  default     = "10.16.0.0/14"
}

variable "services_cidr" {
  description = "Secondary CIDR for services"
  type        = string
  default     = "10.20.0.0/20"
}

variable "release_channel" {
  description = "GKE release channel: RAPID, REGULAR, or STABLE"
  type        = string
  default     = "REGULAR"
}

variable "master_authorized_cidr" {
  description = "CIDR block authorized to access the K8s API server (your IP)"
  type        = string
  default     = "0.0.0.0/0" # Restrict in production
}
