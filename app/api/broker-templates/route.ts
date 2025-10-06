import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// Path to the broker templates JSON file
const TEMPLATES_FILE = path.join(process.cwd(), 'middleware/CONFIG_SYSTEM_DEVICE/JSON/brokerTemplates.json');

interface BrokerTemplate {
  template_id: string;
  name: string;
  description: string;
  category: string;
  config: {
    protocol: string;
    host: string;
    port: number;
    ssl: boolean;
    username?: string;
    password?: string;
    qos: number;
    retain: boolean;
    keepalive: number;
    connection_timeout: number;
    reconnect_period: number;
  };
  fallback_brokers?: Array<{
    host: string;
    port: number;
    protocol: string;
    path?: string;
  }>;
  metadata: {
    created_by: string;
    version: string;
    last_updated: string;
    created_at?: string;
    updated_at?: string;
  };
}

async function readTemplates(): Promise<{ templates: BrokerTemplate[] }> {
  try {
    const data = await fs.readFile(TEMPLATES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading templates file:', error);
    return { templates: [] };
  }
}

async function writeTemplates(data: { templates: BrokerTemplate[] }): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(TEMPLATES_FILE);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(TEMPLATES_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing templates file:', error);
    throw error;
  }
}

// GET /api/broker-templates - Get all templates
export async function GET() {
  try {
    const data = await readTemplates();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in GET /api/broker-templates:', error);
    return NextResponse.json(
      { error: 'Failed to load templates' },
      { status: 500 }
    );
  }
}

// POST /api/broker-templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const template: BrokerTemplate = await request.json();

    // Validate required fields
    if (!template.template_id || !template.name || !template.config?.host || !template.config?.port) {
      return NextResponse.json(
        { error: 'Missing required fields: template_id, name, config.host, config.port' },
        { status: 400 }
      );
    }

    const data = await readTemplates();

    // Check if template already exists
    if (data.templates.some(t => t.template_id === template.template_id)) {
      return NextResponse.json(
        { error: 'Template with this ID already exists' },
        { status: 409 }
      );
    }

    // Add creation metadata
    template.metadata = {
      ...template.metadata,
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    data.templates.push(template);
    await writeTemplates(data);

    return NextResponse.json(
      { message: 'Template created successfully', template },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/broker-templates:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
