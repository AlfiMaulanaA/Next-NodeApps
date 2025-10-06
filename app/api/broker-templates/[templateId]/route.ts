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

// GET /api/broker-templates/[templateId] - Get specific template
export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const { templateId } = params;
    const data = await readTemplates();

    const template = data.templates.find(t => t.template_id === templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error in GET /api/broker-templates/[templateId]:', error);
    return NextResponse.json(
      { error: 'Failed to load template' },
      { status: 500 }
    );
  }
}

// PUT /api/broker-templates/[templateId] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const { templateId } = params;
    const updates: Partial<BrokerTemplate> = await request.json();

    const data = await readTemplates();
    const templateIndex = data.templates.findIndex(t => t.template_id === templateId);

    if (templateIndex === -1) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Update template
    const existingTemplate = data.templates[templateIndex];
    const updatedTemplate = {
      ...existingTemplate,
      ...updates,
      template_id: templateId, // Ensure ID doesn't change
      metadata: {
        ...existingTemplate.metadata,
        ...updates.metadata,
        updated_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        // Increment version
        version: updates.metadata?.version || existingTemplate.metadata.version
      }
    };

    data.templates[templateIndex] = updatedTemplate;
    await writeTemplates(data);

    return NextResponse.json({
      message: 'Template updated successfully',
      template: updatedTemplate
    });
  } catch (error) {
    console.error('Error in PUT /api/broker-templates/[templateId]:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/broker-templates/[templateId] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const { templateId } = params;
    const data = await readTemplates();

    const templateIndex = data.templates.findIndex(t => t.template_id === templateId);
    if (templateIndex === -1) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Remove template
    data.templates.splice(templateIndex, 1);
    await writeTemplates(data);

    return NextResponse.json({
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/broker-templates/[templateId]:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
