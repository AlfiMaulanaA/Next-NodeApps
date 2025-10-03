#!/usr/bin/env python3
"""
Payload Command Processor Service

Advanced payload processing service that handles command-based payloads
with configuration management stored in JSON format.

Supported Commands:
- get: Retrieve payload configurations
- create: Create new payload configuration
- update: Update existing payload configuration
- delete: Delete payload configuration

Configuration Storage: ./JSON/payloadStaticConfig.json

Author: AI Assistant
Version: 2.0
"""

import json
import time
import threading
import logging
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import os

# Configuration
CONFIG_FILE_PATH = "./JSON/payloadStaticConfig.json"
LOG_FILE_PATH = "./logs/payload_processor.log"
BACKUP_DIR = "./backups"

# Ensure directories exist
os.makedirs(os.path.dirname(CONFIG_FILE_PATH), exist_ok=True)
os.makedirs(LOG_FILE_PATH.replace('payload_processor.log', ''), exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)

class CommandType(Enum):
    """Supported command types"""
    GET = "get"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"

@dataclass
class PayloadConfig:
    """Payload configuration data structure"""
    id: str
    topic: str
    data: Dict[str, Any]
    interval: int = 10
    qos: int = 0
    lwt: bool = True
    retain: bool = False
    created_at: str = ""
    updated_at: str = ""
    version: int = 1

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        if not self.updated_at:
            self.updated_at = self.created_at

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PayloadConfig':
        return cls(**data)

@dataclass
class CommandPayload:
    """Command payload structure"""
    command: str
    data: Optional[Dict[str, Any]] = None
    id: Optional[str] = None
    topic: Optional[str] = None
    timestamp: Optional[str] = None

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CommandPayload':
        return cls(**data)

@dataclass
class CommandResult:
    """Command execution result"""
    success: bool
    command: str
    message: str
    data: Optional[Any] = None
    error_code: Optional[str] = None
    execution_time: float = 0.0
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class PayloadProcessorError(Exception):
    """Custom exception for payload processor errors"""
    def __init__(self, message: str, error_code: str = "UNKNOWN_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)

class ConfigurationManager:
    """Thread-safe configuration file manager"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.lock = threading.RLock()
        self.backup_count = 5

    def _create_backup(self) -> None:
        """Create backup of current configuration"""
        try:
            if os.path.exists(self.file_path):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_path = f"{BACKUP_DIR}/payloadStaticConfig_{timestamp}.json"

                with open(self.file_path, 'r') as src:
                    with open(backup_path, 'w') as dst:
                        dst.write(src.read())

                # Keep only last N backups
                backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith('payloadStaticConfig_')])
                if len(backups) > self.backup_count:
                    for old_backup in backups[:-self.backup_count]:
                        os.remove(os.path.join(BACKUP_DIR, old_backup))

        except Exception as e:
            logging.warning(f"Failed to create backup: {e}")

    def load_config(self) -> List[PayloadConfig]:
        """Load configuration from file"""
        with self.lock:
            try:
                if not os.path.exists(self.file_path):
                    return []

                with open(self.file_path, 'r') as f:
                    data = json.load(f)

                configs = []
                for item in data:
                    try:
                        config = PayloadConfig.from_dict(item)
                        configs.append(config)
                    except Exception as e:
                        logging.error(f"Invalid config item: {item}, error: {e}")
                        continue

                return configs

            except json.JSONDecodeError as e:
                logging.error(f"JSON decode error in config file: {e}")
                return []
            except Exception as e:
                logging.error(f"Error loading config: {e}")
                return []

    def save_config(self, configs: List[PayloadConfig]) -> bool:
        """Save configuration to file"""
        with self.lock:
            try:
                self._create_backup()

                # Convert to dict and add metadata
                data = []
                for config in configs:
                    config.updated_at = datetime.now().isoformat()
                    data.append(config.to_dict())

                with open(self.file_path, 'w') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                return True

            except Exception as e:
                logging.error(f"Error saving config: {e}")
                return False

    def get_config_by_id(self, config_id: str) -> Optional[PayloadConfig]:
        """Get configuration by ID"""
        configs = self.load_config()
        for config in configs:
            if config.id == config_id:
                return config
        return None

    def get_config_by_topic(self, topic: str) -> Optional[PayloadConfig]:
        """Get configuration by topic"""
        configs = self.load_config()
        for config in configs:
            if config.topic == topic:
                return config
        return None

class PayloadCommandProcessor:
    """Main payload command processor"""

    def __init__(self):
        self.config_manager = ConfigurationManager(CONFIG_FILE_PATH)
        self.command_stats = {
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "avg_execution_time": 0.0
        }
        self.execution_times = []
        self.lock = threading.RLock()

        # Setup logging
        self._setup_logging()

    def _setup_logging(self):
        """Setup comprehensive logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(LOG_FILE_PATH),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger("PayloadCommandProcessor")

    def _validate_command_payload(self, payload: Dict[str, Any]) -> CommandPayload:
        """Validate incoming command payload"""
        try:
            cmd_payload = CommandPayload.from_dict(payload)

            # Validate command type
            if cmd_payload.command not in [cmd.value for cmd in CommandType]:
                raise PayloadProcessorError(
                    f"Invalid command: {cmd_payload.command}",
                    "INVALID_COMMAND"
                )

            # Validate required fields based on command
            if cmd_payload.command in [CommandType.CREATE.value, CommandType.UPDATE.value]:
                if not cmd_payload.data:
                    raise PayloadProcessorError(
                        f"Data required for {cmd_payload.command} command",
                        "MISSING_DATA"
                    )

            if cmd_payload.command in [CommandType.UPDATE.value, CommandType.DELETE.value]:
                if not cmd_payload.id and not cmd_payload.topic:
                    raise PayloadProcessorError(
                        f"ID or topic required for {cmd_payload.command} command",
                        "MISSING_IDENTIFIER"
                    )

            return cmd_payload

        except KeyError as e:
            raise PayloadProcessorError(f"Missing required field: {e}", "MISSING_FIELD")
        except Exception as e:
            raise PayloadProcessorError(f"Invalid payload format: {e}", "INVALID_FORMAT")

    def _generate_id(self, topic: str, data: Dict[str, Any]) -> str:
        """Generate unique ID for payload configuration"""
        content = f"{topic}_{json.dumps(data, sort_keys=True)}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

    def _update_stats(self, execution_time: float, success: bool):
        """Update command execution statistics"""
        with self.lock:
            self.command_stats["processed"] += 1
            if success:
                self.command_stats["successful"] += 1
            else:
                self.command_stats["failed"] += 1

            self.execution_times.append(execution_time)
            if len(self.execution_times) > 100:
                self.execution_times.pop(0)

            self.command_stats["avg_execution_time"] = sum(self.execution_times) / len(self.execution_times)

    def process_command(self, payload: Dict[str, Any]) -> CommandResult:
        """Process incoming command payload"""
        start_time = time.time()

        try:
            # Validate payload
            cmd_payload = self._validate_command_payload(payload)

            self.logger.info(f"Processing command: {cmd_payload.command}")

            # Execute command
            if cmd_payload.command == CommandType.GET.value:
                result = self._handle_get(cmd_payload)
            elif cmd_payload.command == CommandType.CREATE.value:
                result = self._handle_create(cmd_payload)
            elif cmd_payload.command == CommandType.UPDATE.value:
                result = self._handle_update(cmd_payload)
            elif cmd_payload.command == CommandType.DELETE.value:
                result = self._handle_delete(cmd_payload)
            else:
                raise PayloadProcessorError("Unsupported command", "UNSUPPORTED_COMMAND")

            execution_time = time.time() - start_time
            result.execution_time = execution_time

            self._update_stats(execution_time, result.success)

            if result.success:
                self.logger.info(f"Command {cmd_payload.command} executed successfully")
            else:
                self.logger.error(f"Command {cmd_payload.command} failed: {result.message}")

            return result

        except PayloadProcessorError as e:
            execution_time = time.time() - start_time
            self._update_stats(execution_time, False)

            self.logger.error(f"Command processing error: {e.message}")
            return CommandResult(
                success=False,
                command=payload.get('command', 'unknown'),
                message=e.message,
                error_code=e.error_code,
                execution_time=execution_time
            )

        except Exception as e:
            execution_time = time.time() - start_time
            self._update_stats(execution_time, False)

            error_msg = f"Unexpected error: {str(e)}"
            self.logger.error(error_msg)
            return CommandResult(
                success=False,
                command=payload.get('command', 'unknown'),
                message=error_msg,
                error_code="INTERNAL_ERROR",
                execution_time=execution_time
            )

    def _handle_get(self, cmd_payload: CommandPayload) -> CommandResult:
        """Handle GET command"""
        configs = self.config_manager.load_config()

        if cmd_payload.id:
            config = self.config_manager.get_config_by_id(cmd_payload.id)
            if config:
                return CommandResult(
                    success=True,
                    command=CommandType.GET.value,
                    message="Configuration retrieved successfully",
                    data=config.to_dict()
                )
            else:
                return CommandResult(
                    success=False,
                    command=CommandType.GET.value,
                    message=f"Configuration with ID {cmd_payload.id} not found",
                    error_code="NOT_FOUND"
                )

        elif cmd_payload.topic:
            config = self.config_manager.get_config_by_topic(cmd_payload.topic)
            if config:
                return CommandResult(
                    success=True,
                    command=CommandType.GET.value,
                    message="Configuration retrieved successfully",
                    data=config.to_dict()
                )
            else:
                return CommandResult(
                    success=False,
                    command=CommandType.GET.value,
                    message=f"Configuration with topic {cmd_payload.topic} not found",
                    error_code="NOT_FOUND"
                )

        else:
            # Return all configurations
            return CommandResult(
                success=True,
                command=CommandType.GET.value,
                message=f"Retrieved {len(configs)} configurations",
                data=[config.to_dict() for config in configs]
            )

    def _handle_create(self, cmd_payload: CommandPayload) -> CommandResult:
        """Handle CREATE command"""
        if not cmd_payload.data:
            return CommandResult(
                success=False,
                command=CommandType.CREATE.value,
                message="Data is required for create command",
                error_code="MISSING_DATA"
            )

        # Check if topic already exists
        existing = self.config_manager.get_config_by_topic(cmd_payload.data.get('topic', ''))
        if existing:
            return CommandResult(
                success=False,
                command=CommandType.CREATE.value,
                message=f"Configuration with topic {cmd_payload.data['topic']} already exists",
                error_code="DUPLICATE_TOPIC"
            )

        # Generate ID and create config
        config_id = self._generate_id(
            cmd_payload.data.get('topic', ''),
            cmd_payload.data.get('data', {})
        )

        config = PayloadConfig(
            id=config_id,
            topic=cmd_payload.data.get('topic', ''),
            data=cmd_payload.data.get('data', {}),
            interval=cmd_payload.data.get('interval', 10),
            qos=cmd_payload.data.get('qos', 0),
            lwt=cmd_payload.data.get('lwt', True),
            retain=cmd_payload.data.get('retain', False)
        )

        # Load current configs and add new one
        configs = self.config_manager.load_config()
        configs.append(config)

        if self.config_manager.save_config(configs):
            return CommandResult(
                success=True,
                command=CommandType.CREATE.value,
                message="Configuration created successfully",
                data=config.to_dict()
            )
        else:
            return CommandResult(
                success=False,
                command=CommandType.CREATE.value,
                message="Failed to save configuration",
                error_code="SAVE_FAILED"
            )

    def _handle_update(self, cmd_payload: CommandPayload) -> CommandResult:
        """Handle UPDATE command"""
        if not cmd_payload.data:
            return CommandResult(
                success=False,
                command=CommandType.UPDATE.value,
                message="Data is required for update command",
                error_code="MISSING_DATA"
            )

        # Find existing configuration
        config = None
        if cmd_payload.id:
            config = self.config_manager.get_config_by_id(cmd_payload.id)
        elif cmd_payload.topic:
            config = self.config_manager.get_config_by_topic(cmd_payload.topic)

        if not config:
            identifier = cmd_payload.id or cmd_payload.topic
            return CommandResult(
                success=False,
                command=CommandType.UPDATE.value,
                message=f"Configuration {identifier} not found",
                error_code="NOT_FOUND"
            )

        # Update configuration
        config.data = cmd_payload.data.get('data', config.data)
        config.interval = cmd_payload.data.get('interval', config.interval)
        config.qos = cmd_payload.data.get('qos', config.qos)
        config.lwt = cmd_payload.data.get('lwt', config.lwt)
        config.retain = cmd_payload.data.get('retain', config.retain)
        config.version += 1

        # Save updated configs
        configs = self.config_manager.load_config()
        for i, c in enumerate(configs):
            if c.id == config.id:
                configs[i] = config
                break

        if self.config_manager.save_config(configs):
            return CommandResult(
                success=True,
                command=CommandType.UPDATE.value,
                message="Configuration updated successfully",
                data=config.to_dict()
            )
        else:
            return CommandResult(
                success=False,
                command=CommandType.UPDATE.value,
                message="Failed to save updated configuration",
                error_code="SAVE_FAILED"
            )

    def _handle_delete(self, cmd_payload: CommandPayload) -> CommandResult:
        """Handle DELETE command"""
        # Find configuration to delete
        config = None
        if cmd_payload.id:
            config = self.config_manager.get_config_by_id(cmd_payload.id)
        elif cmd_payload.topic:
            config = self.config_manager.get_config_by_topic(cmd_payload.topic)

        if not config:
            identifier = cmd_payload.id or cmd_payload.topic
            return CommandResult(
                success=False,
                command=CommandType.DELETE.value,
                message=f"Configuration {identifier} not found",
                error_code="NOT_FOUND"
            )

        # Remove configuration
        configs = self.config_manager.load_config()
        configs = [c for c in configs if c.id != config.id]

        if self.config_manager.save_config(configs):
            return CommandResult(
                success=True,
                command=CommandType.DELETE.value,
                message="Configuration deleted successfully",
                data={"deleted_id": config.id, "deleted_topic": config.topic}
            )
        else:
            return CommandResult(
                success=False,
                command=CommandType.DELETE.value,
                message="Failed to delete configuration",
                error_code="DELETE_FAILED"
            )

    def get_stats(self) -> Dict[str, Any]:
        """Get processor statistics"""
        with self.lock:
            return self.command_stats.copy()

    def health_check(self) -> Dict[str, Any]:
        """Perform health check"""
        try:
            configs = self.config_manager.load_config()
            config_count = len(configs)

            return {
                "status": "healthy",
                "config_count": config_count,
                "config_file_exists": os.path.exists(CONFIG_FILE_PATH),
                "backup_dir_exists": os.path.exists(BACKUP_DIR),
                "last_backup": self._get_last_backup_time(),
                "stats": self.get_stats()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }

    def _get_last_backup_time(self) -> Optional[str]:
        """Get timestamp of last backup"""
        try:
            backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.startswith('payloadStaticConfig_')])
            if backups:
                return backups[-1].replace('payloadStaticConfig_', '').replace('.json', '')
        except:
            pass
        return None

def main():
    """Main function for testing"""
    processor = PayloadCommandProcessor()

    print("=== Payload Command Processor Test ===")

    # Test commands
    test_commands = [
        {"command": "get"},  # Get all
        {
            "command": "create",
            "data": {
                "topic": "test/sensor/001",
                "data": {"temperature": 25.5, "humidity": 60},
                "interval": 5
            }
        },
        {"command": "get", "topic": "test/sensor/001"},  # Get by topic
        {
            "command": "update",
            "topic": "test/sensor/001",
            "data": {
                "data": {"temperature": 28.3, "humidity": 65, "pressure": 1013},
                "interval": 10
            }
        },
        {"command": "get", "topic": "test/sensor/001"},  # Verify update
        {"command": "delete", "topic": "test/sensor/001"},  # Delete
        {"command": "get"}  # Verify deletion
    ]

    for i, cmd in enumerate(test_commands, 1):
        print(f"\n--- Test {i}: {cmd['command'].upper()} ---")
        result = processor.process_command(cmd)
        print(f"Success: {result.success}")
        print(f"Message: {result.message}")
        if result.data:
            print(f"Data: {json.dumps(result.data, indent=2)}")
        print(f"Execution Time: {result.execution_time:.4f}s")

    # Show stats
    print("\n=== Final Statistics ===")
    stats = processor.get_stats()
    for key, value in stats.items():
        print(f"{key}: {value}")

    # Health check
    print("\n=== Health Check ===")
    health = processor.health_check()
    for key, value in health.items():
        print(f"{key}: {value}")

if __name__ == "__main__":
    main()
