# ============================================================
# Nexus Platform — AWS Infrastructure (Terraform)
# ============================================================

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
  }

  backend "s3" {
    bucket         = "nexus-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "nexus-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Nexus Platform"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ---- VPC ----
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "nexus-${var.environment}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }
}

# ---- EKS Cluster ----
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "nexus-${var.environment}"
  cluster_version = "1.30"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  cluster_addons = {
    coredns                = { most_recent = true }
    kube-proxy             = { most_recent = true }
    vpc-cni                = { most_recent = true }
    aws-ebs-csi-driver     = { most_recent = true }
  }

  eks_managed_node_groups = {
    # General workloads
    general = {
      instance_types = ["m6i.xlarge"]
      min_size       = 3
      max_size       = 20
      desired_size   = 3
      labels = { workload = "general" }
    }

    # AI workloads (more memory)
    ai = {
      instance_types = ["r6i.2xlarge"]
      min_size       = 1
      max_size       = 10
      desired_size   = 2
      labels = { workload = "ai" }
      taints = [{ key = "workload", value = "ai", effect = "NO_SCHEDULE" }]
    }
  }
}

# ---- RDS (PostgreSQL) ----
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "nexus-${var.environment}-postgres"

  engine               = "postgres"
  engine_version       = "16.4"
  instance_class       = var.environment == "production" ? "db.r6g.2xlarge" : "db.t4g.medium"
  allocated_storage    = 100
  max_allocated_storage = 1000
  storage_encrypted    = true

  db_name  = "nexus_db"
  username = "nexus"
  port     = "5432"

  multi_az               = var.environment == "production"
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [module.security_groups.rds_sg_id]

  maintenance_window      = "Mon:00:00-Mon:03:00"
  backup_window           = "03:00-06:00"
  backup_retention_period = var.environment == "production" ? 30 : 7

  performance_insights_enabled = true
  monitoring_interval          = 60

  deletion_protection = var.environment == "production"
}

# ---- ElastiCache (Redis) ----
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "nexus-${var.environment}-redis"
  description          = "Nexus Platform Redis cache"

  node_type            = var.environment == "production" ? "cache.r6g.xlarge" : "cache.t4g.small"
  num_cache_clusters   = var.environment == "production" ? 3 : 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [module.security_groups.redis_sg_id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled           = var.environment == "production"

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "nexus-${var.environment}-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

# ---- S3 (File Storage) ----
resource "aws_s3_bucket" "files" {
  bucket        = "nexus-${var.environment}-files-${random_id.bucket_suffix.hex}"
  force_destroy = var.environment != "production"
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---- CloudFront (CDN) ----
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  aliases             = ["cdn.nexusplatform.io"]

  origin {
    domain_name = aws_s3_bucket.files.bucket_regional_domain_name
    origin_id   = "s3-nexus-files"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-nexus-files"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = var.cloudfront_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "Nexus Platform CDN OAI"
}

# ---- CloudWatch Log Groups ----
resource "aws_cloudwatch_log_group" "redis" {
  name              = "/nexus/${var.environment}/redis"
  retention_in_days = 30
}

module "security_groups" {
  source      = "./modules/security-groups"
  vpc_id      = module.vpc.vpc_id
  environment = var.environment
}
