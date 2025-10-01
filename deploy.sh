#!/bin/bash

# NewContainment Deployment Script
# Author: Claude Code Assistant
# Description: Automated deployment script for NewContainment IoT System
#
# Usage:
#   sudo ./deploy.sh           - Standard deployment (ports 3000, 5000)
#   sudo ./deploy.sh -p        - Production deployment with port 80 access
#   sudo ./deploy.sh --production - Production deployment with port 80 access
#   sudo ./deploy.sh update-prod  - Pull latest changes and redeploy in production mode

set -e # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
FRONTEND_DIR="$PROJECT_ROOT"

# Log function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js installation
check_nodejs() {
    log "Checking Node.js installation..."

    # Check for Node.js in multiple locations
    local node_path=""
    local npm_path=""

    if command_exists node; then
        node_path=$(which node)
    elif [ -x "/usr/local/bin/node" ]; then
        node_path="/usr/local/bin/node"
    fi

    if command_exists npm; then
        npm_path=$(which npm)
    elif [ -x "/usr/local/bin/npm" ]; then
        npm_path="/usr/local/bin/npm"
    fi

    if [ -n "$node_path" ] && [ -n "$npm_path" ]; then
        NODE_VERSION=$("$node_path" --version 2>/dev/null || echo "unknown")
        NPM_VERSION=$("$npm_path" --version 2>/dev/null || echo "unknown")
        log_success "Node.js $NODE_VERSION and npm $NPM_VERSION are installed"
        log "Node.js path: $node_path"
        log "npm path: $npm_path"
        return 0
    else
        log_error "Node.js or npm not found"
        return 1
    fi
}

# Function to install Node.js
install_nodejs() {
    log "Installing Node.js..."

    # Detect architecture
    local arch=$(uname -m)
    log "Detected architecture: $arch"

    # For ARM systems (like NanoPi), use alternative installation methods
    if [[ "$arch" == "armv7l" || "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
        log "ARM architecture detected, using NodeSource binary installation..."
        install_nodejs_arm
        return $?
    fi

    # For x64 systems, try NodeSource repository
    log "Using NodeSource repository installation..."
    if curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -; then
        if sudo apt-get install -y nodejs; then
            log_success "Node.js installed successfully"
            return 0
        else
            log_warning "Repository installation failed, trying manual installation..."
            install_nodejs_arm
            return $?
        fi
    else
        log_warning "NodeSource setup failed, trying manual installation..."
        install_nodejs_arm
        return $?
    fi
}

# Function to manually install Node.js for ARM
install_nodejs_arm() {
    log "=== Manual Node.js Installation for ARM ==="
    local arch=$(uname -m)
    local node_version="18.20.4"  # LTS version

    # Determine download URL based on architecture
    local download_url
    local tar_name

    case $arch in
        "armv7l")
            download_url="https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-armv7l.tar.xz"
            tar_name="node-v${node_version}-linux-armv7l.tar.xz"
            ;;
        "aarch64"|"arm64")
            download_url="https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-arm64.tar.xz"
            tar_name="node-v${node_version}-linux-arm64.tar.xz"
            ;;
        "x86_64")
            download_url="https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-x64.tar.xz"
            tar_name="node-v${node_version}-linux-x64.tar.xz"
            ;;
        *)
            log_error "Unsupported architecture for manual Node.js installation: $arch"
            return 1
            ;;
    esac

    # Create Node.js directory
    local node_dir="/usr/local/lib/nodejs"
    sudo mkdir -p "$node_dir"

    log "Downloading Node.js $node_version for $arch..."
    if ! wget -O "/tmp/$tar_name" "$download_url"; then
        log_error "Failed to download Node.js"
        return 1
    fi

    log "Extracting Node.js..."
    if ! sudo tar -xJf "/tmp/$tar_name" -C "$node_dir" --strip-components=1; then
        log_error "Failed to extract Node.js"
        return 1
    fi

    # Clean up
    rm "/tmp/$tar_name"

    # Create symlinks
    sudo ln -sf "$node_dir/bin/node" /usr/local/bin/node
    sudo ln -sf "$node_dir/bin/npm" /usr/local/bin/npm
    sudo ln -sf "$node_dir/bin/npx" /usr/local/bin/npx

    # Add to PATH for current session
    export PATH="/usr/local/bin:$PATH"

    # Add to system PATH
    echo 'export PATH="/usr/local/bin:$PATH"' | sudo tee -a /etc/environment > /dev/null

    # Update current shell PATH
    source /etc/environment 2>/dev/null || true

    # Verify installation
    if /usr/local/bin/node --version >/dev/null 2>&1; then
        local installed_version=$(/usr/local/bin/node --version)
        log_success "Manual Node.js installation completed - Node.js $installed_version"
        return 0
    else
        log_error "Node.js installation verification failed"
        return 1
    fi
}



# Function to check PM2 installation
check_pm2() {
    log "Checking PM2 installation..."

    # Check for PM2 in multiple locations
    local pm2_path=""

    if command_exists pm2; then
        pm2_path=$(which pm2)
    elif [ -x "/usr/local/bin/pm2" ]; then
        pm2_path="/usr/local/bin/pm2"
    elif [ -x "/usr/local/lib/nodejs/bin/pm2" ]; then
        pm2_path="/usr/local/lib/nodejs/bin/pm2"
    fi

    if [ -n "$pm2_path" ]; then
        PM2_VERSION=$("$pm2_path" --version 2>/dev/null || echo "unknown")
        log_success "PM2 $PM2_VERSION is installed"
        log "PM2 path: $pm2_path"
        return 0
    else
        log_error "PM2 not found"
        return 1
    fi
}

# Function to install PM2
install_pm2() {
    log "Installing PM2..."

    # Ensure Node.js and npm are available
    local npm_path
    if command -v npm >/dev/null 2>&1; then
        npm_path=$(which npm)
    elif [ -x "/usr/local/bin/npm" ]; then
        npm_path="/usr/local/bin/npm"
    else
        log_error "npm not found. Please ensure Node.js is properly installed."
        return 1
    fi

    log "Using npm at: $npm_path"

    # Install PM2 globally
    if sudo "$npm_path" install -g pm2; then
        log_success "PM2 installed successfully"

        # Create symlink if PM2 is not in standard PATH
        if [ -f "/usr/local/lib/nodejs/bin/pm2" ]; then
            sudo ln -sf /usr/local/lib/nodejs/bin/pm2 /usr/local/bin/pm2
        fi

        # Setup PM2 startup script
        local pm2_path
        if command -v pm2 >/dev/null 2>&1; then
            pm2_path=$(which pm2)
        elif [ -x "/usr/local/bin/pm2" ]; then
            pm2_path="/usr/local/bin/pm2"
        fi

        if [ -n "$pm2_path" ]; then
            log "Setting up PM2 startup script..."
            sudo env PATH="/usr/local/bin:$PATH" "$pm2_path" startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || log_warning "PM2 startup script setup failed, but PM2 is installed"
        fi

        return 0
    else
        log_error "PM2 installation failed"
        return 1
    fi
}

# Function to check all dependencies
check_dependencies() {
    log "=== Checking Dependencies ==="

    local missing_deps=()

    if ! check_nodejs; then
        missing_deps+=("nodejs")
    fi



    if ! check_pm2; then
        missing_deps+=("pm2")
    fi

    if [ ${#missing_deps[@]} -eq 0 ]; then
        log_success "All dependencies are installed"
        return 0
    else
        log_warning "Missing dependencies: ${missing_deps[*]}"
        return 1
    fi
}

# Function to install missing dependencies with better error handling
install_dependencies() {
    log "=== Installing Missing Dependencies ==="

    # Update package list
    log "Updating package lists..."
    sudo apt-get update

    local installation_results=()
    local critical_failures=()

    # Try to install each missing dependency
    if ! check_nodejs; then
        log "Installing Node.js..."
        if install_nodejs; then
            installation_results+=("nodejs:success")
            log_success "Node.js installation completed"
        else
            installation_results+=("nodejs:failed")
            critical_failures+=("nodejs")
            log_error "Node.js installation failed - this is critical for frontend"
        fi
    fi



    if ! check_pm2; then
        log "Installing PM2..."
        if install_pm2; then
            installation_results+=("pm2:success")
            log_success "PM2 installation completed"
        else
            installation_results+=("pm2:failed")
            critical_failures+=("pm2")
            log_error "PM2 installation failed - this is critical for frontend deployment"
        fi
    fi

    # Report results
    log "=== Installation Results ==="
    for result in "${installation_results[@]}"; do
        local dep=$(echo "$result" | cut -d':' -f1)
        local status=$(echo "$result" | cut -d':' -f2)
        if [ "$status" = "success" ]; then
            log_success "$dep: ✓ Installed successfully"
        else
            log_warning "$dep: ✗ Installation failed"
        fi
    done

    # Check if we can continue
    if [ ${#critical_failures[@]} -gt 0 ]; then
        log_error "Critical dependencies failed: ${critical_failures[*]}"
        log_error "Cannot continue deployment without these components"
        return 1
    else
        log_success "All critical dependencies are available"
        return 0
    fi
}

# Function to build and deploy frontend
deploy_frontend() {
    log "=== Deploying Frontend ==="

    if [ ! -d "$FRONTEND_DIR" ]; then
        log_error "Frontend directory not found: $FRONTEND_DIR"
        return 1
    fi

    cd "$FRONTEND_DIR"

    log "=== Frontend Build Fix Process ==="

    # Clean previous build artifacts
    log "Cleaning previous build artifacts..."
    rm -rf .next node_modules/.cache 2>/dev/null || true

    # Clear npm cache to avoid corruption issues
    log "Clearing npm cache..."
    npm cache clean --force 2>/dev/null || true

    # Verify critical files exist before building
    log "Verifying critical files exist..."
    CRITICAL_FILES=("hooks/useMQTT.ts" "components/ui/card.tsx" "components/ui/button.tsx" "components/ui/badge.tsx" "components/ui/table.tsx")
    for file in "${CRITICAL_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Critical file missing: $file"
            return 1
        fi
    done
    log_success "All critical files verified"

    log "Installing frontend dependencies (production only)..."
    # Use --omit=dev to install only production dependencies
    if ! npm install --omit=dev; then
        log_error "Frontend dependency installation failed"
        return 1
    fi

    # Backup and create simplified next.config for build
    log "Creating simplified Next.js configuration for build..."
    cp next.config.mjs next.config.mjs.backup 2>/dev/null || true
    cat > next.config.build.mjs << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ["localhost"],
  },
  compress: true,
};

export default nextConfig;
EOF
    cp next.config.build.mjs next.config.mjs
    rm next.config.build.mjs

    log "Building frontend with simplified configuration..."
    if ! npm run build; then
        log_error "Frontend build failed"
        # Restore original config on failure
        mv next.config.mjs.backup next.config.mjs 2>/dev/null || true
        return 1
    fi

    # Restore original configuration
    log "Restoring original Next.js configuration..."
    mv next.config.mjs.backup next.config.mjs 2>/dev/null || true

    log "Verifying build output..."
    if [ ! -d ".next" ]; then
        log_error "Next.js build failed - .next directory not found"
        return 1
    fi

    log "Stopping existing PM2 processes..."
    # '2>/dev/null || true' prevents script from exiting if process doesn't exist
    pm2 delete newcontainment-frontend 2>/dev/null || true

    # Create ecosystem.config.js file dynamically
    log "Creating ecosystem.config.js..."
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "newcontainment-frontend",
      script: "npm",
      args: "start",
      cwd: "./",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm Z",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
    },
  ],
};
EOF

    log "Starting frontend with PM2 using ecosystem file..."
    pm2 start ecosystem.config.js
    pm2 save

    log "Waiting for frontend to start..."
    sleep 8

    # Verify frontend is running and accessible
    local frontend_running=false
    for i in {1..10}; do
        if pm2 list | grep -q "newcontainment-frontend.*online"; then
            log "PM2 process is online, checking port accessibility..."

            if netstat -tuln | grep -q ":3000"; then
                log_success "Frontend is accessible on port 3000"
                frontend_running=true
                break
            else
                log_warning "Port 3000 not listening yet, waiting..."
            fi
        fi
        sleep 2
    done

    if [ "$frontend_running" = false ]; then
        log_error "Frontend failed to start properly"

        # Check if build directory exists
        if [ ! -d "$FRONTEND_DIR/.next" ]; then
            log_error "Build directory missing - frontend was not built properly"
            return 1
        fi

        # Stop the errored process and restart with fresh config
        log "Stopping errored PM2 process..."
        pm2 stop newcontainment-frontend 2>/dev/null || true
        pm2 delete newcontainment-frontend 2>/dev/null || true

        # Wait a moment and try to start again with explicit settings
        sleep 2
        log "Attempting to restart frontend with explicit configuration..."

        # Create a more robust ecosystem config
        cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "newcontainment-frontend",
      script: "npm",
      args: "start",
      cwd: "/home/containment/NewContainment/Frontend",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      max_restarts: 3,
      restart_delay: 5000
    }
  ]
};
EOF

        # Try starting once more
        if pm2 start ecosystem.config.js; then
            sleep 3
            if pm2 list | grep -q "online.*newcontainment-frontend"; then
                log_success "Frontend restarted successfully"
                frontend_running=true
            else
                log_error "Frontend still failing to start - check build output"
            fi
        else
            log_error "Failed to restart frontend with PM2"
        fi
        return 1
    fi

    log_success "Frontend deployed successfully"
    return 0
}






# Function to show deployment status (frontend only)
show_partial_status() {
    log "=== Frontend-Only Deployment Status ==="

    echo ""
    log "Frontend Status (PM2):"
    pm2 list

    echo ""
    log "Service URLs:"
    echo "    Frontend: http://localhost:3000"

    echo ""
    log "System Information:"
    echo "    Node Version: $(node --version 2>/dev/null || echo 'Not found')"
    echo "    Deployment Time: $(date)"

    echo ""
    log "Useful Commands:"
    echo "    Frontend logs: pm2 logs newcontainment-frontend"
    echo "    Restart frontend: pm2 restart newcontainment-frontend"

    echo ""
    log_success "Frontend deployment completed successfully!"
}



# Function to create enhanced Nginx configuration
create_nginx_config() {
    log "Creating Nginx directory..."
    mkdir -p "$NGINX_DIR"

    log "Creating enhanced Nginx reverse proxy configuration..."
    cat > "$NGINX_DIR/newcontainment.conf" << 'EOF'
# NewContainment Nginx Reverse Proxy Configuration for Port 80
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Permitted-Cross-Domain-Policies none always;

    # Remove server signature
    server_tokens off;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting for API endpoints
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # API endpoints redirect to frontend (no backend)
    location /api/ {
        # Apply rate limiting
        limit_req zone=api burst=20 nodelay;

        # Return 503 Service Unavailable for API calls (no backend)
        return 503 '{"error": "Backend API not available", "message": "This deployment is frontend-only"}';
        add_header Content-Type application/json;
    }

    # WebSocket support for MQTT and real-time features
    location /ws/ {
        proxy_pass http://localhost:3000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket specific timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cache static assets for 1 month
        expires 1M;
        add_header Cache-Control "public, immutable";
        add_header X-Cache-Status "HIT-STATIC";
    }

    # Frontend proxy for all other requests
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Frontend specific timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 '{"status":"healthy","timestamp":"$time_iso8601","server":"nginx"}';
        add_header Content-Type application/json;
    }

    # Nginx status for monitoring (restrict to localhost)
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        allow ::1;
        deny all;
    }

    # Block common attack patterns
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~* /(wp-admin|admin|phpmyadmin|wp-login|xmlrpc) {
        deny all;
        access_log off;
        log_not_found off;
        return 444;
    }

    # Custom error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;

    location = /50x.html {
        root /usr/share/nginx/html;
    }
}

# Optional: Redirect HTTP to HTTPS (uncomment when SSL is configured)
# server {
#     listen 80;
#     listen [::]:80;
#     server_name your-domain.com www.your-domain.com;
#     return 301 https://$server_name$request_uri;
# }
EOF

    log_success "Enhanced Nginx reverse proxy configuration created"
}

# Function to setup production environment
setup_production_env() {
    log "=== Setting Up Production Environment ==="

    cd "$FRONTEND_DIR"

    # Update CORS to include current server
    local server_ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
    log "Server IP detected: $server_ip"

    # Setup production environment for frontend
    if [ -f ".env.production" ]; then
        log "Using production environment configuration"
        cp .env.production .env.local
    else
        log_warning "No .env.production found, using current .env"
    fi

    log_success "Production environment configured"
    cd "$PROJECT_ROOT"
}

# Function to verify port 80 access
verify_port80() {
    log "=== Verifying Port 80 Access ==="

    # Wait for services to start
    sleep 5

    # Check if port 80 is listening
    if netstat -tuln 2>/dev/null | grep -q ":80" || ss -tuln 2>/dev/null | grep -q ":80"; then
        log_success "Port 80 is listening"

        # Test HTTP access
        if curl -s http://localhost >/dev/null 2>&1; then
            log_success "HTTP access on port 80 is working"
        else
            log_warning "Port 80 listening but HTTP test failed"
        fi
    else
        log_warning "Port 80 is not listening"
    fi

    # Show current listening ports
    log "Current listening ports:"
    (netstat -tuln 2>/dev/null || ss -tuln 2>/dev/null) | grep -E ":(80|3000|5000)" | sed 's/^/  /' || echo "  No netstat/ss available"

    return 0
}

# Function to show production status with port 80 info
show_production_status() {
    log "=== 🚀 Production Deployment Status ==="

    echo ""
    log "Service Status:"

    if pm2 list 2>/dev/null | grep -q newcontainment-frontend; then
        echo "  Frontend PM2: $(pm2 list | grep newcontainment-frontend | awk '{print $18}' | head -1)"
    else
        echo "  Frontend PM2: not running"
    fi

    echo ""
    log "🌐 Access URLs:"
    local server_ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
    echo "  🎯 Main Application: http://$server_ip"
    echo "  🏠 Local Access: http://localhost"
    echo "  ❤️ Health Check: http://$server_ip/health"

    echo ""
    log "🔧 Direct Service Access:"
    echo "  Frontend (Next.js): http://$server_ip:3000"

    echo ""
    log "📊 Port Status:"
    local ports_output
    if ports_output=$((netstat -tuln 2>/dev/null || ss -tuln 2>/dev/null) | grep -E ":(80|3000)"); then
        echo "$ports_output" | sed 's/^/  /'
    else
        echo "  No port information available"
    fi

    echo ""
    log "📋 Log Commands:"
    echo "  📄 Frontend logs: pm2 logs newcontainment-frontend"

    echo ""
    log "🛠️ Management Commands:"
    echo "  🔄 Restart all: pm2 restart newcontainment-frontend"
    echo "  🔄 Restart frontend: pm2 restart newcontainment-frontend"

    # Check firewall status if available
    if command_exists ufw; then
        echo ""
        log "🔥 Firewall Status:"
        local ufw_status=$(sudo ufw status 2>/dev/null | grep -E "(Status|80)" || echo "UFW not configured")
        echo "$ufw_status" | sed 's/^/  /'
        if ! echo "$ufw_status" | grep -q "80"; then
            log_warning "Port 80 may not be allowed in firewall. Run: sudo ufw allow 80"
        fi
    fi

    echo ""
    log_success "🎉 Production deployment completed successfully!"
}

# Main deployment function
main() {
    log "=== NewContainment Deployment Script ==="
    log "Project Root: $PROJECT_ROOT"
    log "Current User: $(whoami)"

    # Check for production mode flag
    local production_mode=false
    if [[ "$1" == "--production" || "$1" == "-p" ]]; then
        production_mode=true
        log "🚀 Production mode enabled - will setup port 80 access"
    fi

    # Step 1: Check and install dependencies
    if ! check_dependencies; then
        log "Installing missing dependencies..."
        if ! install_dependencies; then
            log_error "Critical dependency installation failed."
            log "Please install missing dependencies manually and re-run the script."
            log "Required: Node.js, PM2"
            exit 1
        fi

        # Re-check dependencies after installation
        log "Re-checking dependencies after installation..."
        check_dependencies || true  # Don't exit if some non-critical deps are missing
    fi

    # Initialize deployment status flags
    local frontend_deployed=false
    local can_deploy_frontend=false

    # Check what can be deployed
    if check_nodejs && command_exists pm2; then
        can_deploy_frontend=true
        log_success "Frontend deployment prerequisites met"
    else
        log_warning "Frontend deployment prerequisites not met - Node.js or PM2 missing"
    fi

    # Step 2: Deploy frontend (with error handling)
    if [ "$can_deploy_frontend" = true ]; then
        log "=== Attempting Frontend Deployment ==="
        if deploy_frontend; then
            frontend_deployed=true
            log_success "Frontend deployment completed successfully"
        else
            log_error "Frontend deployment failed"
            exit 1
        fi
    else
        log_error "Frontend deployment prerequisites not met - Node.js or PM2 missing"
        exit 1
    fi

    # Step 3: Verify frontend deployment
    log "=== Verifying Frontend Deployment ==="
    log "Checking frontend health..."
    local frontend_ready=false
    for i in {1..10}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            frontend_ready=true
            break
        fi
        sleep 2
    done

    if [ "$frontend_ready" = true ]; then
        log_success "Frontend is accessible"
    else
        log_warning "Frontend health check failed"
    fi

    # Production-specific setup if enabled
    if [ "$production_mode" = true ]; then
        log "🚀 Setting up production environment..."

        # Setup production configurations
        setup_production_env


        # Restart frontend with new configs
        log "Restarting frontend for production setup..."
        if [ "$frontend_deployed" = true ] && pm2 list | grep -q newcontainment-frontend; then
            pm2 restart newcontainment-frontend || true
        fi

        # Verify port 80 access
        # Show production-specific status
        show_partial_status
    else
        # Step 4: Show frontend-only status
        show_partial_status
    fi
}

# Function to update production (pull and redeploy)
update_prod() {
    log "=== Production Update (Pull & Redeploy) ==="

    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        log_error "Not a git repository. Please run this script from the project root."
        exit 1
    fi

    # Stash any local changes to prevent conflicts
    log "Stashing local changes..."
    git stash push -m "Auto-stash before update: $(date)" 2>/dev/null || true

    # Pull latest changes
    log "Pulling latest changes from remote repository..."
    if ! git pull origin main; then
        log_error "Git pull failed. Please resolve conflicts manually."
        log "You can recover stashed changes with: git stash pop"
        exit 1
    fi

    # Check if there are any changes
    local changes_pulled=$(git diff HEAD@{1} --name-only 2>/dev/null | wc -l || echo "0")
    if [ "$changes_pulled" -eq "0" ]; then
        log "No changes detected. Repository is already up to date."
        log "Current deployment should still be running."
        return 0
    fi

    log_success "Successfully pulled $changes_pulled changed files"

    # Show what changed
    log "Recent changes:"
    git log --oneline -5 | sed 's/^/  /' || true

    # Stop services before rebuilding
    log "Stopping services before rebuild..."
    pm2 delete newcontainment-frontend 2>/dev/null || true
    sudo systemctl stop NewContainmentWeb.service 2>/dev/null || true

    # Redeploy with production settings
    log "Redeploying with production settings..."
    main --production

    log_success "Production update completed successfully!"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Check for update-prod command
    if [[ "$1" == "update-prod" ]]; then
        update_prod
    else
        main "$@"
    fi
fi