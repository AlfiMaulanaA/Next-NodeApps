#!/bin/bash

# UI Build & Zip Script untuk Next.js App
# Format output: out-YYYY-MM-DD.zip
# Author: Alfi Maulana

set -e  # Exit on any error

# Colors untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OUTPUT_DIR="dist"
BUILD_DIR=".next"
STATIC_DIR="out"
ZIP_PREFIX="out"
TODAY=$(date +%Y-%m-%d)
ZIP_NAME="${ZIP_PREFIX}-${TODAY}.zip"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Function untuk menampilkan usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Build Next.js application and create zip file with format: out-YYYY-MM-DD.zip"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -c, --clean         Clean build artifacts before building"
    echo "  -s, --static        Build for static export (npm run export)"
    echo "  -n, --no-build      Skip build, just create zip from existing build"
    echo "  -o, --output FILE   Custom output zip filename (default: $ZIP_NAME)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build and create zip"
    echo "  $0 -c                 # Clean and build"
    echo "  $0 -s                 # Build for static export"
    echo "  $0 -o custom.zip      # Custom output filename"
}

# Function untuk check dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    # Check if node and npm are installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi

    # Check if zip is installed
    if ! command -v zip &> /dev/null; then
        log_error "zip command is not installed. Please install zip first."
        exit 1
    fi

    log_success "All dependencies are available"
}

# Function untuk clean build artifacts
clean_build() {
    log_info "Cleaning previous build artifacts..."

    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        log_info "Removed $BUILD_DIR directory"
    fi

    if [ -d "$STATIC_DIR" ]; then
        rm -rf "$STATIC_DIR"
        log_info "Removed $STATIC_DIR directory"
    fi

    if [ -d "$OUTPUT_DIR" ]; then
        rm -rf "$OUTPUT_DIR"
        log_info "Removed $OUTPUT_DIR directory"
    fi

    # Clean node_modules cache (optional)
    if [ "$1" = "deep" ]; then
        log_info "Performing deep clean..."
        rm -rf node_modules/.cache 2>/dev/null || true
        npm cache clean --force 2>/dev/null || true
    fi

    log_success "Clean completed"
}

# Function untuk install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi

    # Check if node_modules exists and is up to date
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        log_info "Installing npm packages..."
        npm install
        log_success "Dependencies installed"
    else
        log_info "Dependencies already installed and up to date"
    fi
}

# Function untuk build aplikasi
build_app() {
    local build_static="$1"

    log_info "Building Next.js application..."

    # Ensure dependencies are installed
    install_dependencies

    if [ "$build_static" = "true" ]; then
        log_info "Building for static export..."
        # For static export, we need to build first then export
        npm run build
        npm run export
        BUILD_TARGET="$STATIC_DIR"
        log_success "Static export completed"
    else
        log_info "Building for production..."
        npm run build
        BUILD_TARGET="$BUILD_DIR"
        log_success "Production build completed"
    fi

    # Verify build output exists
    if [ ! -d "$BUILD_TARGET" ]; then
        log_error "Build failed: $BUILD_TARGET directory not found"
        exit 1
    fi

    log_info "Build output: $(du -sh "$BUILD_TARGET" | cut -f1)"
}

# Function untuk validate build
validate_build() {
    local build_target="$1"

    log_info "Validating build output..."

    # Check if essential files exist
    if [ "$build_target" = "$BUILD_DIR" ]; then
        # For .next build
        if [ ! -f "$build_target/server/pages/index.html" ] && [ ! -f "$build_target/static/chunks/main.js" ]; then
            log_warning "Build validation failed: essential files not found"
            log_warning "This might still be valid for server-side rendering"
        fi
    else
        # For static export
        if [ ! -f "$build_target/index.html" ]; then
            log_error "Static build validation failed: index.html not found"
            exit 1
        fi
    fi

    # Check file count
    local file_count=$(find "$build_target" -type f | wc -l)
    log_info "Build contains $file_count files"
    log_success "Build validation completed"
}

# Function untuk create zip
create_zip() {
    local zip_filename="$1"
    local build_target="$2"

    log_info "Creating zip file: $zip_filename"

    # Create output directory if it doesn't exist
    mkdir -p "$OUTPUT_DIR"

    local full_zip_path="$OUTPUT_DIR/$zip_filename"

    # Remove existing zip if it exists
    if [ -f "$full_zip_path" ]; then
        log_warning "Existing zip file found, overwriting..."
        rm -f "$full_zip_path"
    fi

    # Create zip with progress
    log_info "Compressing files..."
    cd "$build_target"
    zip -r "../$OUTPUT_DIR/$zip_filename" . > /dev/null 2>&1
    cd - > /dev/null

    # Get zip file size
    local zip_size=$(du -h "$full_zip_path" | cut -f1)
    log_success "Zip file created: $full_zip_path (${zip_size})"

    # Show zip contents summary
    local zip_file_count=$(unzip -l "$full_zip_path" | wc -l)
    log_info "Files in zip: $((zip_file_count - 3))"  # Subtract header lines
}

# Function untuk show summary
show_summary() {
    local zip_filename="$1"
    local build_target="$2"
    local zip_path="$OUTPUT_DIR/$zip_filename"

    echo ""
    echo "=================================================="
    echo "🏗️  BUILD SUMMARY"
    echo "=================================================="
    echo "📅 Date: $(date)"
    echo "📦 Zip File: $zip_path"
    echo "📊 Zip Size: $(du -h "$zip_path" | cut -f1)"
    echo "📁 Build Source: $build_target"
    echo "📂 Build Size: $(du -sh "$build_target" | cut -f1)"
    echo "📄 Files: $(find "$build_target" -type f | wc -l) files"
    echo ""
    echo "💡 Upload this zip file to the UI Update Manager"
    echo "   at /settings/ui-update in your application"
    echo "=================================================="
}

# Function untuk cleanup on error
cleanup_on_error() {
    log_error "Build script failed!"

    # Ask user if they want to cleanup
    echo ""
    read -p "Do you want to clean up build artifacts? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        clean_build
        log_info "Cleanup completed"
    fi

    exit 1
}

# Main script
main() {
    local clean=false
    local build_static=false
    local skip_build=false
    local custom_output=""

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -c|--clean)
                clean=true
                shift
                ;;
            -s|--static)
                build_static=true
                shift
                ;;
            -n|--no-build)
                skip_build=true
                shift
                ;;
            -o|--output)
                custom_output="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Set custom output name if provided
    if [ -n "$custom_output" ]; then
        ZIP_NAME="$custom_output"
    fi

    log_info "Starting UI Build Script..."
    log_info "Output: $ZIP_NAME"
    echo ""

    # Set up error handling
    trap cleanup_on_error ERR

    # Check dependencies
    check_dependencies

    # Clean if requested
    if [ "$clean" = "true" ]; then
        clean_build
    fi

    # Build application
    if [ "$skip_build" = "false" ]; then
        build_app "$build_static"
    else
        # For skip build, determine build target
        if [ "$build_static" = "true" ] && [ -d "$STATIC_DIR" ]; then
            BUILD_TARGET="$STATIC_DIR"
            log_info "Using existing static build: $STATIC_DIR"
        elif [ -d "$BUILD_DIR" ]; then
            BUILD_TARGET="$BUILD_DIR"
            log_info "Using existing build: $BUILD_DIR"
        else
            log_error "No existing build found. Run without --no-build option."
            exit 1
        fi
    fi

    # Validate build
    validate_build "$BUILD_TARGET"

    # Create zip
    create_zip "$ZIP_NAME" "$BUILD_TARGET"

    # Show summary
    show_summary "$ZIP_NAME" "$BUILD_TARGET"

    log_success "UI Build Script completed successfully! 🎉"
}

# Run main function
main "$@"
