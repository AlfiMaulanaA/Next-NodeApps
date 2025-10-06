import json
import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import re

class BrokerTemplateManager:
    """Manages MQTT broker templates for static payload system"""

    def __init__(self, templates_file: str = "./JSON/brokerTemplates.json"):
        self.templates_file = templates_file
        self.templates: Dict[str, Any] = {}
        self.logger = logging.getLogger("BrokerTemplateManager")
        self.load_templates()

    def load_templates(self) -> None:
        """Load broker templates from JSON file"""
        try:
            if os.path.exists(self.templates_file):
                with open(self.templates_file, 'r') as f:
                    data = json.load(f)
                    self.templates = {template['template_id']: template for template in data.get('templates', [])}
                    self.logger.info(f"Loaded {len(self.templates)} broker templates")
            else:
                self.logger.warning(f"Templates file not found: {self.templates_file}")
                self.templates = {}
        except Exception as e:
            self.logger.error(f"Error loading templates: {e}")
            self.templates = {}

    def save_templates(self) -> bool:
        """Save broker templates to JSON file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.templates_file), exist_ok=True)

            # Convert templates dict back to list format
            templates_list = list(self.templates.values())

            with open(self.templates_file, 'w') as f:
                json.dump({
                    "templates": templates_list,
                    "metadata": {
                        "last_updated": datetime.now().isoformat(),
                        "total_templates": len(templates_list)
                    }
                }, f, indent=2)

            self.logger.info(f"Saved {len(templates_list)} broker templates")
            return True
        except Exception as e:
            self.logger.error(f"Error saving templates: {e}")
            return False

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific template by ID"""
        return self.templates.get(template_id)

    def get_all_templates(self) -> List[Dict[str, Any]]:
        """Get all available templates"""
        return list(self.templates.values())

    def get_templates_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get templates by category"""
        return [template for template in self.templates.values() if template.get('category') == category]

    def create_template(self, template_data: Dict[str, Any]) -> bool:
        """Create a new broker template"""
        try:
            template_id = template_data.get('template_id')
            if not template_id:
                self.logger.error("Template ID is required")
                return False

            if template_id in self.templates:
                self.logger.error(f"Template {template_id} already exists")
                return False

            # Add metadata
            template_data['metadata'] = template_data.get('metadata', {})
            template_data['metadata']['created_at'] = datetime.now().isoformat()
            template_data['metadata']['version'] = "1.0"

            # Validate template structure
            if not self._validate_template(template_data):
                return False

            self.templates[template_id] = template_data
            self.save_templates()
            self.logger.info(f"Created new template: {template_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error creating template: {e}")
            return False

    def update_template(self, template_id: str, template_data: Dict[str, Any]) -> bool:
        """Update an existing template"""
        try:
            if template_id not in self.templates:
                self.logger.error(f"Template {template_id} not found")
                return False

            # Preserve existing metadata
            existing_metadata = self.templates[template_id].get('metadata', {})

            # Update template
            self.templates[template_id].update(template_data)
            self.templates[template_id]['metadata'] = existing_metadata
            self.templates[template_id]['metadata']['updated_at'] = datetime.now().isoformat()

            # Increment version
            current_version = self.templates[template_id]['metadata'].get('version', '1.0')
            version_parts = current_version.split('.')
            major, minor = map(int, version_parts[0].split('.'))
            self.templates[template_id]['metadata']['version'] = f"{major}.{minor + 1}"

            self.save_templates()
            self.logger.info(f"Updated template: {template_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error updating template: {e}")
            return False

    def delete_template(self, template_id: str) -> bool:
        """Delete a template"""
        try:
            if template_id not in self.templates:
                self.logger.error(f"Template {template_id} not found")
                return False

            del self.templates[template_id]
            self.save_templates()
            self.logger.info(f"Deleted template: {template_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error deleting template: {e}")
            return False

    def resolve_template_variables(self, template_config: Dict[str, Any], variables: Dict[str, str] = None) -> Dict[str, Any]:
        """Resolve template variables with provided values"""
        try:
            resolved_config = json.loads(json.dumps(template_config))  # Deep copy

            # Default variables
            default_vars = {
                "${CLOUD_USERNAME}": "default_cloud_user",
                "${CLOUD_PASSWORD}": "default_cloud_pass",
                "${EDGE_PASSWORD}": "default_edge_pass",
                "${BACKUP_USERNAME}": "default_backup_user",
                "${BACKUP_PASSWORD}": "default_backup_pass"
            }

            # Merge with provided variables
            if variables:
                default_vars.update(variables)

            # Resolve string values
            def resolve_value(value):
                if isinstance(value, str):
                    for var, replacement in default_vars.items():
                        value = value.replace(var, replacement)
                    return value
                elif isinstance(value, dict):
                    return {k: resolve_value(v) for k, v in value.items()}
                elif isinstance(value, list):
                    return [resolve_value(item) for item in value]
                else:
                    return value

            return resolve_value(resolved_config)
        except Exception as e:
            self.logger.error(f"Error resolving template variables: {e}")
            return template_config

    def _validate_template(self, template: Dict[str, Any]) -> bool:
        """Validate template structure"""
        required_fields = ['template_id', 'name', 'config']

        for field in required_fields:
            if field not in template:
                self.logger.error(f"Missing required field: {field}")
                return False

        # Validate config structure
        config = template.get('config', {})
        required_config_fields = ['host', 'port', 'protocol']

        for field in required_config_fields:
            if field not in config:
                self.logger.error(f"Missing required config field: {field}")
                return False

        # Validate port number
        try:
            port = int(config.get('port', 0))
            if port < 1 or port > 65535:
                self.logger.error(f"Invalid port number: {port}")
                return False
        except ValueError:
            self.logger.error(f"Port must be a number: {config.get('port')}")
            return False

        return True

    def get_template_stats(self) -> Dict[str, Any]:
        """Get template statistics"""
        categories = {}
        for template in self.templates.values():
            category = template.get('category', 'unknown')
            categories[category] = categories.get(category, 0) + 1

        return {
            "total_templates": len(self.templates),
            "categories": categories,
            "templates_by_category": {
                category: [t['name'] for t in self.templates.values() if t.get('category') == category]
                for category in categories.keys()
            }
        }

    def search_templates(self, query: str) -> List[Dict[str, Any]]:
        """Search templates by name or description"""
        query = query.lower()
        results = []

        for template in self.templates.values():
            if (query in template.get('name', '').lower() or
                query in template.get('description', '').lower() or
                query in template.get('template_id', '').lower()):
                results.append(template)

        return results

    def export_templates(self, export_file: str) -> bool:
        """Export templates to external file"""
        try:
            templates_list = list(self.templates.values())

            with open(export_file, 'w') as f:
                json.dump({
                    "exported_at": datetime.now().isoformat(),
                    "total_templates": len(templates_list),
                    "templates": templates_list
                }, f, indent=2)

            self.logger.info(f"Exported {len(templates_list)} templates to {export_file}")
            return True
        except Exception as e:
            self.logger.error(f"Error exporting templates: {e}")
            return False

    def import_templates(self, import_file: str, merge: bool = True) -> bool:
        """Import templates from external file"""
        try:
            with open(import_file, 'r') as f:
                data = json.load(f)

            imported_templates = data.get('templates', [])
            imported_count = 0

            for template in imported_templates:
                template_id = template.get('template_id')
                if template_id:
                    if merge and template_id in self.templates:
                        # Update existing template
                        self.update_template(template_id, template)
                    else:
                        # Create new template
                        self.templates[template_id] = template
                    imported_count += 1

            if imported_count > 0:
                self.save_templates()
                self.logger.info(f"Imported {imported_count} templates from {import_file}")
                return True
            else:
                self.logger.warning(f"No valid templates found in {import_file}")
                return False
        except Exception as e:
            self.logger.error(f"Error importing templates: {e}")
            return False
