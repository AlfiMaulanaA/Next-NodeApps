#!/bin/bash

# Next.js MQTT IoT Dashboard - Complete Deployment Script
# This script handles full deployment with package checking, nginx setup, and systemd service

set -e

REPO_URL="https://github.com/AlfiMaulanaA/Next-NodeApps.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
CURRENT_DIR=$(pwd)
LOG_FILE="/var/log/nextjs_mqtt_deploy.log"
BACKUP_DIR="/opt/nextjs_backups/$(date +%Y%m%d_%H%M%S)"
APP_NAME="nextjs-mqtt-dashboard"
FRONTEND_PORT=3000
PROXY_PORT=8080
SERVICE_NAME="multiprocessing"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Deployment status tracking
declare -A DEPLOYMENT_STATUS
DEPLOYMENT_STATUS[packages]=0
DEPLOYMENT_STATUS[python_deps]=0
DEPLOYMENT_STATUS[frontend]=0
DEPLOYMENT_STATUS[nginx]=0
DEPLOYMENT_STATUS[service]=0

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Next.js MQTT IoT Dashboard Deploy${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    log_message "SUCCESS: $1"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
    log_message "ERROR: $1"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    log_message "WARNING: $1"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
    log_message "INFO: $1"
}

print_step() {
    echo -e "${BLUE}═══ STEP $1: $2 ═══${NC}"
    log_message "STEP $1: $2"
}

# Step 1: Check and Install Required Packages
check_and_install_packages() {
    print_step "1" "Checking and Installing Required Packages"

    local packages_success=true
    local required_packages=(
        "mosquitto:mosquitto-clients:MQTT Broker"
        "nginx:nginx:Nginx Web Server"
        "nodejs:node:Node.js Runtime"
        "npm:npm:Node Package Manager"
        "python3:python3:Python 3 Runtime"
        "python3-pip:pip3:Python Package Manager"
        "python3-venv:python3:Python Virtual Environment"
        "curl:curl:HTTP Client"
        "wget:wget:File Downloader"
    )

    print_info "Updating package list..."
    if sudo apt update >> "$LOG_FILE" 2>&1; then
        print_success "Package list updated"
    else
        print_error "Failed to update package list"
        packages_success=false
    fi

    for package_info in "${required_packages[@]}"; do
        IFS=':' read -r package_name check_command description <<< "$package_info"

        print_info "Checking $description ($package_name)..."

        if command -v "$check_command" &> /dev/null; then
            print_success "$description is already installed"
        else
            print_warning "$description not found. Installing..."
            if sudo apt install -y "$package_name" >> "$LOG_FILE" 2>&1; then
                print_success "$description installed successfully"
            else
                print_error "Failed to install $description - skipping"
                packages_success=false
            fi
        fi
    done

    # Check and install PM2
    print_info "Checking PM2..."
    if command -v pm2 &> /dev/null; then
        print_success "PM2 is already installed"
    else
        print_warning "PM2 not found. Installing..."
        if sudo npm install -g pm2 >> "$LOG_FILE" 2>&1; then
            print_success "PM2 installed successfully"
        else
            print_error "Failed to install PM2 - skipping"
            packages_success=false
        fi
    fi

    # Check Node.js version
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_VERSION -ge 16 ]]; then
            print_success "Node.js version $(node -v) is compatible"
        else
            print_warning "Node.js version $(node -v) may be too old (minimum v16 recommended)"
        fi
    fi

    if $packages_success; then
        DEPLOYMENT_STATUS[packages]=1
        print_success "All required packages checked/installed successfully"
    else
        print_warning "Some packages failed to install but continuing deployment"
    fi

    print_info "Package check completed"
}

# Step 1.5: Install Python Dependencies
install_python_dependencies() {
    print_step "1.5" "Installing Python Dependencies from requirements.txt"

    local python_success=true
    local requirements_file="$PROJECT_DIR/middleware/CONFIG_SYSTEM_DEVICE/requirements.txt"

    # Check if requirements.txt exists
    if [[ ! -f "$requirements_file" ]]; then
        print_error "Requirements file not found at $requirements_file"
        print_warning "Skipping Python dependencies installation"
        return
    fi

    # Check if Python 3 and pip are available
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed - skipping Python dependencies"
        return
    fi

    if ! command -v pip3 &> /dev/null; then
        print_error "pip3 is not installed - skipping Python dependencies"
        return
    fi

    print_info "Python 3 version: $(python3 --version)"
    print_info "pip3 version: $(pip3 --version)"

    # Upgrade pip to latest version
    print_info "Upgrading pip to latest version..."
    if python3 -m pip install --upgrade pip >> "$LOG_FILE" 2>&1; then
        print_success "pip upgraded successfully"
    else
        print_warning "Failed to upgrade pip - continuing with current version"
    fi

    # Install wheel for better package installation
    print_info "Installing wheel package..."
    if python3 -m pip install wheel >> "$LOG_FILE" 2>&1; then
        print_success "wheel package installed"
    else
        print_warning "Failed to install wheel - continuing without it"
    fi

    # Create virtual environment directory if it doesn't exist
    local venv_dir="$PROJECT_DIR/middleware/CONFIG_SYSTEM_DEVICE/venv"
    if [[ ! -d "$venv_dir" ]]; then
        print_info "Creating Python virtual environment..."
        if python3 -m venv "$venv_dir" >> "$LOG_FILE" 2>&1; then
            print_success "Virtual environment created at $venv_dir"
        else
            print_warning "Failed to create virtual environment, installing globally"
            venv_dir=""
        fi
    else
        print_info "Using existing virtual environment at $venv_dir"
    fi

    # Activate virtual environment if available
    if [[ -n "$venv_dir" && -f "$venv_dir/bin/activate" ]]; then
        print_info "Activating virtual environment..."
        source "$venv_dir/bin/activate"
        print_success "Virtual environment activated"
    fi

    # Install requirements from file
    print_info "Installing Python packages from requirements.txt..."
    print_info "Requirements file: $requirements_file"

    # Show what will be installed
    print_info "Packages to be installed:"
    while IFS= read -r line; do
        if [[ ! "$line" =~ ^# && -n "$line" ]]; then
            echo "  - $line"
        fi
    done < "$requirements_file"

    # Install with timeout and error handling
    if timeout 300 python3 -m pip install -r "$requirements_file" --upgrade >> "$LOG_FILE" 2>&1; then
        print_success "Python packages installed successfully"
        DEPLOYMENT_STATUS[python_deps]=1

        # Verify critical packages
        print_info "Verifying critical Python packages..."
        local critical_packages=("flask" "paho-mqtt" "psutil" "requests")
        local verification_success=true

        for package in "${critical_packages[@]}"; do
            if python3 -c "import $package" >> "$LOG_FILE" 2>&1; then
                print_success "$package is available"
            else
                print_warning "$package verification failed"
                verification_success=false
            fi
        done

        if $verification_success; then
            print_success "All critical packages verified"
        else
            print_warning "Some packages failed verification but installation completed"
        fi

    else
        print_error "Failed to install Python packages"
        python_success=false

        # Try installing critical packages individually
        print_info "Attempting to install critical packages individually..."
        local essential_packages=("flask>=1.1.0" "paho-mqtt>=1.5.0" "psutil>=5.6.0" "requests>=2.20.0")
        local individual_success=false

        for package in "${essential_packages[@]}"; do
            print_info "Installing $package..."
            if python3 -m pip install "$package" >> "$LOG_FILE" 2>&1; then
                print_success "$package installed"
                individual_success=true
            else
                print_warning "Failed to install $package"
            fi
        done

        if $individual_success; then
            print_warning "Some Python packages installed individually"
            DEPLOYMENT_STATUS[python_deps]=1
        fi
    fi

    # Deactivate virtual environment if it was activated
    if [[ -n "$venv_dir" && -f "$venv_dir/bin/activate" ]]; then
        deactivate 2>/dev/null || true
        print_info "Virtual environment deactivated"
    fi

    # Show installed packages summary
    print_info "Installed Python packages summary:"
    if [[ -n "$venv_dir" && -f "$venv_dir/bin/activate" ]]; then
        source "$venv_dir/bin/activate"
        python3 -m pip list | head -20 >> "$LOG_FILE" 2>&1
        deactivate 2>/dev/null || true
    else
        python3 -m pip list | head -20 >> "$LOG_FILE" 2>&1
    fi

    if ! $python_success && [[ ${DEPLOYMENT_STATUS[python_deps]} -eq 0 ]]; then
        print_warning "Python dependencies installation failed but continuing with deployment"
    fi

    print_info "Python dependencies installation completed"
}

# Step 3: Build and Deploy Frontend
build_and_deploy_frontend() {
    print_step "3" "Building and Deploying Frontend"

    local frontend_success=true

    cd "$PROJECT_DIR"

    # Create backup
    print_info "Creating backup of current installation..."
    if [[ -d "$PROJECT_DIR" && -f "$PROJECT_DIR/package.json" ]]; then
        mkdir -p "$BACKUP_DIR"
        cp -r "$PROJECT_DIR"/{app,components,lib,contexts,middleware,data,public} "$BACKUP_DIR/" 2>/dev/null || true
        cp "$PROJECT_DIR"/package.json "$BACKUP_DIR/" 2>/dev/null || true
        print_success "Backup created at: $BACKUP_DIR"
    fi

    # Stop existing services
    print_info "Stopping existing services..."
    pm2 stop "$APP_NAME" 2>/dev/null || print_info "No PM2 process named '$APP_NAME' to stop"
    pm2 delete "$APP_NAME" 2>/dev/null || print_info "No PM2 process named '$APP_NAME' to delete"

    # Setup environment
    print_info "Setting up environment..."
    mkdir -p data logs
    chmod 755 data logs

    if [[ ! -f ".env" && -f ".env.template" ]]; then
        cp ".env.template" ".env"
        print_success "Created .env file from template"
    fi

    # Install dependencies
    print_info "Installing npm dependencies..."
    if npm cache clean --force >> "$LOG_FILE" 2>&1 && npm install >> "$LOG_FILE" 2>&1; then
        print_success "NPM dependencies installed"
    else
        print_error "Failed to install NPM dependencies"
        frontend_success=false
    fi

    # Build application
    if $frontend_success; then
        print_info "Building Next.js application..."
        rm -rf .next
        export NODE_ENV=production

        if npm run build >> "$LOG_FILE" 2>&1; then
            print_success "Application built successfully"
        else
            print_error "Failed to build application"
            frontend_success=false
        fi
    fi

    # Create PM2 configuration and start
    if $frontend_success; then
        print_info "Creating PM2 configuration..."
        cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'npm',
    args: 'start',
    cwd: '$PROJECT_DIR',
    env: {
      NODE_ENV: 'production',
      PORT: $FRONTEND_PORT
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '$PROJECT_DIR/logs/error.log',
    out_file: '$PROJECT_DIR/logs/out.log',
    log_file: '$PROJECT_DIR/logs/combined.log',
    time: true,
    node_args: '--max_old_space_size=1024'
  }]
};
EOF

        print_info "Starting application with PM2..."
        if pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1; then
            pm2 save >> "$LOG_FILE" 2>&1
            print_success "Application started with PM2"

            # Wait and verify
            sleep 5
            if pm2 list | grep -q "$APP_NAME.*online"; then
                print_success "Application is running successfully on port $FRONTEND_PORT"
                DEPLOYMENT_STATUS[frontend]=1
            else
                print_error "Application failed to start properly"
                frontend_success=false
            fi
        else
            print_error "Failed to start application with PM2"
            frontend_success=false
        fi
    fi

    if ! $frontend_success; then
        print_warning "Frontend deployment failed but continuing with other steps"
    fi

    print_info "Frontend deployment step completed"
}

# Step 4: Configure Nginx Reverse Proxy
configure_nginx_proxy() {
    print_step "4" "Configuring Nginx Reverse Proxy"

    local nginx_success=true

    if ! command -v nginx &> /dev/null; then
        print_error "Nginx is not installed - skipping proxy configuration"
        return
    fi

    # Create nginx configuration
    print_info "Creating Nginx configuration..."
    local nginx_config="/etc/nginx/sites-available/nextjs-mqtt-dashboard"

    sudo tee "$nginx_config" > /dev/null << EOF
server {
    listen $PROXY_PORT;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to Next.js application
    location / {
        proxy_pass http://localhost:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Handle static files
    location /_next/static/ {
        proxy_pass http://localhost:$FRONTEND_PORT;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    if [[ $? -eq 0 ]]; then
        print_success "Nginx configuration created"
    else
        print_error "Failed to create Nginx configuration"
        nginx_success=false
    fi

    if $nginx_success; then
        # Enable site
        print_info "Enabling Nginx site..."
        if sudo ln -sf "$nginx_config" "/etc/nginx/sites-enabled/" >> "$LOG_FILE" 2>&1; then
            print_success "Nginx site enabled"
        else
            print_error "Failed to enable Nginx site"
            nginx_success=false
        fi
    fi

    if $nginx_success; then
        # Test and reload nginx
        print_info "Testing Nginx configuration..."
        if sudo nginx -t >> "$LOG_FILE" 2>&1; then
            print_success "Nginx configuration test passed"

            if sudo systemctl reload nginx >> "$LOG_FILE" 2>&1; then
                print_success "Nginx reloaded successfully"
                DEPLOYMENT_STATUS[nginx]=1
            else
                print_error "Failed to reload Nginx"
                nginx_success=false
            fi
        else
            print_error "Nginx configuration test failed"
            nginx_success=false
        fi
    fi

    if ! $nginx_success; then
        print_warning "Nginx configuration failed but continuing with other steps"
    fi

    print_info "Nginx configuration step completed"
}

# Step 5: Install and Configure Systemd Service
setup_systemd_service() {
    print_step "5" "Setting up Systemd Service"

    local service_success=true
    local service_source="$PROJECT_DIR/middleware/SERVICE_FILE/multiprocessing.service"
    local service_target="/etc/systemd/system/$SERVICE_NAME.service"

    # Check if service file exists
    if [[ ! -f "$service_source" ]]; then
        print_error "Service file not found at $service_source"
        print_warning "Skipping systemd service setup"
        return
    fi

    print_info "Installing systemd service..."

    # Copy service file
    if sudo cp "$service_source" "$service_target" >> "$LOG_FILE" 2>&1; then
        print_success "Service file copied to systemd directory"
    else
        print_error "Failed to copy service file"
        service_success=false
    fi

    if $service_success; then
        # Set permissions
        if sudo chmod 644 "$service_target" >> "$LOG_FILE" 2>&1; then
            print_success "Service file permissions set"
        else
            print_error "Failed to set service file permissions"
            service_success=false
        fi
    fi

    if $service_success; then
        # Reload systemd daemon
        print_info "Reloading systemd daemon..."
        if sudo systemctl daemon-reload >> "$LOG_FILE" 2>&1; then
            print_success "Systemd daemon reloaded"
        else
            print_error "Failed to reload systemd daemon"
            service_success=false
        fi
    fi

    if $service_success; then
        # Enable service
        print_info "Enabling $SERVICE_NAME service..."
        if sudo systemctl enable "$SERVICE_NAME" >> "$LOG_FILE" 2>&1; then
            print_success "Service enabled for automatic startup"
        else
            print_error "Failed to enable service"
            service_success=false
        fi
    fi

    if $service_success; then
        # Start service
        print_info "Starting $SERVICE_NAME service..."
        if sudo systemctl start "$SERVICE_NAME" >> "$LOG_FILE" 2>&1; then
            print_success "Service started successfully"

            # Verify service status
            sleep 2
            if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
                print_success "Service is running properly"
                DEPLOYMENT_STATUS[service]=1
            else
                print_error "Service is not running properly"
                sudo systemctl status "$SERVICE_NAME" --no-pager >> "$LOG_FILE" 2>&1
                service_success=false
            fi
        else
            print_error "Failed to start service"
            service_success=false
        fi
    fi

    if ! $service_success; then
        print_warning "Systemd service setup failed but deployment continues"
    fi

    print_info "Systemd service setup completed"
}

# Step 6: Generate Deployment Summary
generate_deployment_summary() {
    print_step "6" "Deployment Summary and Status Report"

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}      DEPLOYMENT SUMMARY REPORT${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    # System Information
    echo -e "${YELLOW}System Information:${NC}"
    echo "  Hostname: $(hostname)"
    echo "  IP Address: $(hostname -I | awk '{print $1}' 2>/dev/null || echo 'N/A')"
    echo "  Date: $(date)"
    echo "  User: $(whoami)"
    echo ""

    # Deployment Status
    echo -e "${YELLOW}Deployment Status:${NC}"

    if [[ ${DEPLOYMENT_STATUS[packages]} -eq 1 ]]; then
        echo -e "  ${GREEN}✓ System Packages Installation: SUCCESS${NC}"
    else
        echo -e "  ${RED}✗ System Packages Installation: FAILED/PARTIAL${NC}"
    fi

    if [[ ${DEPLOYMENT_STATUS[python_deps]} -eq 1 ]]; then
        echo -e "  ${GREEN}✓ Python Dependencies: SUCCESS${NC}"
        echo "    - Requirements file: middleware/CONFIG_SYSTEM_DEVICE/requirements.txt"
        echo "    - Virtual environment: middleware/CONFIG_SYSTEM_DEVICE/venv/"
        echo "    - Critical packages: flask, paho-mqtt, psutil, requests"
    else
        echo -e "  ${RED}✗ Python Dependencies: FAILED${NC}"
    fi

    if [[ ${DEPLOYMENT_STATUS[frontend]} -eq 1 ]]; then
        echo -e "  ${GREEN}✓ Frontend Application: SUCCESS${NC}"
        echo "    - Port: $FRONTEND_PORT"
        echo "    - Process Manager: PM2"
        echo "    - Status: $(pm2 list | grep "$APP_NAME" | awk '{print $10}' || echo 'Unknown')"
    else
        echo -e "  ${RED}✗ Frontend Application: FAILED${NC}"
    fi

    if [[ ${DEPLOYMENT_STATUS[nginx]} -eq 1 ]]; then
        echo -e "  ${GREEN}✓ Nginx Reverse Proxy: SUCCESS${NC}"
        echo "    - Proxy Port: $PROXY_PORT"
        echo "    - Backend Port: $FRONTEND_PORT"
        echo "    - Status: $(sudo systemctl is-active nginx 2>/dev/null || echo 'Unknown')"
    else
        echo -e "  ${RED}✗ Nginx Reverse Proxy: FAILED${NC}"
    fi

    if [[ ${DEPLOYMENT_STATUS[service]} -eq 1 ]]; then
        echo -e "  ${GREEN}✓ Systemd Service: SUCCESS${NC}"
        echo "    - Service Name: $SERVICE_NAME"
        echo "    - Status: $(sudo systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo 'Unknown')"
    else
        echo -e "  ${RED}✗ Systemd Service: FAILED${NC}"
    fi

    echo ""

    # Access URLs
    echo -e "${YELLOW}Access Information:${NC}"
    local server_ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'localhost')

    if [[ ${DEPLOYMENT_STATUS[frontend]} -eq 1 ]]; then
        echo "  Direct Frontend: http://$server_ip:$FRONTEND_PORT"
    fi

    if [[ ${DEPLOYMENT_STATUS[nginx]} -eq 1 ]]; then
        echo "  Nginx Proxy: http://$server_ip:$PROXY_PORT"
    fi

    echo ""

    # Service Management Commands
    echo -e "${YELLOW}Service Management Commands:${NC}"
    echo "  Frontend (PM2):"
    echo "    pm2 list"
    echo "    pm2 restart $APP_NAME"
    echo "    pm2 logs $APP_NAME"
    echo ""
    echo "  Nginx:"
    echo "    sudo systemctl status nginx"
    echo "    sudo systemctl reload nginx"
    echo "    sudo nginx -t"
    echo ""
    echo "  Python Service:"
    echo "    sudo systemctl status $SERVICE_NAME"
    echo "    sudo systemctl restart $SERVICE_NAME"
    echo "    sudo journalctl -u $SERVICE_NAME -f"
    echo ""

    # Log Files
    echo -e "${YELLOW}Log Files:${NC}"
    echo "  Deployment: $LOG_FILE"
    echo "  Application: $PROJECT_DIR/logs/"
    echo "  Nginx: /var/log/nginx/"
    echo "  Service: sudo journalctl -u $SERVICE_NAME"
    echo ""

    # Calculate success rate
    local total_steps=5
    local successful_steps=0
    for status in "${DEPLOYMENT_STATUS[@]}"; do
        successful_steps=$((successful_steps + status))
    done

    local success_rate=$((successful_steps * 100 / total_steps))

    echo -e "${YELLOW}Overall Success Rate: ${NC}"
    if [[ $success_rate -eq 100 ]]; then
        echo -e "  ${GREEN}$success_rate% - Full deployment successful!${NC}"
    elif [[ $success_rate -ge 75 ]]; then
        echo -e "  ${YELLOW}$success_rate% - Mostly successful with minor issues${NC}"
    elif [[ $success_rate -ge 50 ]]; then
        echo -e "  ${YELLOW}$success_rate% - Partial success, some components failed${NC}"
    else
        echo -e "  ${RED}$success_rate% - Multiple components failed${NC}"
    fi

    echo ""
    echo -e "${BLUE}========================================${NC}"

    # Final recommendation
    if [[ $success_rate -eq 100 ]]; then
        print_success "Deployment completed successfully! All services are running."
    else
        print_warning "Deployment completed with some issues. Check the logs for details."
        echo ""
        echo "To troubleshoot:"
        echo "1. Check logs: tail -f $LOG_FILE"
        echo "2. Verify services manually using the commands above"
        echo "3. Re-run specific steps if needed"
    fi
}

# Cleanup function
cleanup() {
    print_info "Performing cleanup..."

    # Clean old backups (keep last 5)
    if [[ -d "/opt/nextjs_backups" ]]; then
        cd /opt/nextjs_backups
        ls -t | tail -n +6 | xargs -r rm -rf 2>/dev/null || true
        print_success "Old backups cleaned"
    fi

    # Clean npm cache
    npm cache clean --force >> "$LOG_FILE" 2>&1 || true

    print_success "Cleanup completed"
}

# Main deployment function
main() {
    # Create log file and directories
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "/opt/nextjs_backups"
    touch "$LOG_FILE"

    print_header
    log_message "Complete deployment script started"

    # Parse command line arguments
    case "${1:-deploy}" in
        "deploy")
            check_and_install_packages
            install_python_dependencies
            build_and_deploy_frontend
            configure_nginx_proxy
            setup_systemd_service
            cleanup
            generate_deployment_summary
            ;;
        "packages")
            check_and_install_packages
            ;;
        "python")
            install_python_dependencies
            ;;
        "frontend")
            build_and_deploy_frontend
            ;;
        "nginx")
            configure_nginx_proxy
            ;;
        "service")
            setup_systemd_service
            ;;
        "status")
            generate_deployment_summary
            ;;
        "restart-all")
            print_info "Restarting all services..."
            pm2 restart "$APP_NAME" 2>/dev/null || print_warning "PM2 app not found"
            sudo systemctl reload nginx 2>/dev/null || print_warning "Nginx not available"
            sudo systemctl restart "$SERVICE_NAME" 2>/dev/null || print_warning "Service not available"
            print_success "All available services restarted"
            ;;
        *)
            echo "Usage: $0 {deploy|packages|python|frontend|nginx|service|status|restart-all}"
            echo ""
            echo "Commands:"
            echo "  deploy      - Full deployment (all steps)"
            echo "  packages    - Check and install system packages only"
            echo "  python      - Install Python dependencies only"
            echo "  frontend    - Build and deploy frontend only"
            echo "  nginx       - Configure nginx reverse proxy only"
            echo "  service     - Setup systemd service only"
            echo "  status      - Show deployment status and summary"
            echo "  restart-all - Restart all services"
            exit 1
            ;;
    esac

    log_message "Deployment script completed"
}

# Handle script interruption
trap 'print_error "Script interrupted"; exit 1' INT TERM

# Check if running with sufficient privileges for system operations
if [[ $EUID -ne 0 ]] && [[ "${1:-deploy}" != "status" ]]; then
    print_warning "Some operations require root privileges. You may be prompted for sudo password."
fi

# Run main function
main "$@"