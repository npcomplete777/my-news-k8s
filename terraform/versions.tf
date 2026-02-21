terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment to use GCS backend for remote state
  # backend "gcs" {
  #   bucket = "anon-news-tf-state"
  #   prefix = "gke"
  # }
}
