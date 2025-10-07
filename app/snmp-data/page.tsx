'use client';

import { useState, useEffect } from 'react';
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Database, Copy } from "lucide-react";
import * as XLSX from 'xlsx';
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { MIBDownloader } from "@/components/MIBDownloader";
import { showToast } from "@/lib/toast-utils";

interface MIBDataItem {
  category?: string;
  objectName?: string;
  eventName?: string;
  trapName?: string;
  oid: string;
  access: string;
  unit?: string;
  notes?: string;
  description?: string;
}

interface MIBTableItem {
  var_name: string;
  oid: string;
  access: string;
  category: string;
  unit?: string;
  description?: string;
  notes?: string;
}

interface MIBData {
  snmpConfiguration: MIBDataItem[];
  batteryData: MIBDataItem[];
  systemEvents: MIBDataItem[];
  snmpTraps: MIBDataItem[];
}


export default function ModbusDataPage() {
  const [mibData, setMibData] = useState<MIBData | null>(null);
  const [tableData, setTableData] = useState<MIBTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to convert MIB data to table format
  const convertMIBDataToTable = (mibData: MIBData): MIBTableItem[] => {
    const tableItems: MIBTableItem[] = [];

    // Convert SNMP Configuration
    mibData.snmpConfiguration.forEach(item => {
      tableItems.push({
        var_name: item.objectName || 'Unknown',
        oid: item.oid,
        access: item.access,
        category: 'SNMP Configuration',
        description: item.description
      });
    });

    // Convert Battery Data
    mibData.batteryData.forEach(item => {
      tableItems.push({
        var_name: item.objectName || 'Unknown',
        oid: item.oid,
        access: item.access,
        category: item.category || 'Battery Data',
        unit: item.unit,
        notes: item.notes
      });
    });

    // Convert System Events
    mibData.systemEvents.forEach(item => {
      tableItems.push({
        var_name: item.eventName || 'Unknown',
        oid: item.oid,
        access: item.access,
        category: item.category || 'System Events',
        unit: item.unit,
        notes: item.notes
      });
    });

    // Convert SNMP Traps
    mibData.snmpTraps.forEach(item => {
      tableItems.push({
        var_name: item.trapName || 'Unknown',
        oid: item.oid,
        access: 'Read Only', // Traps are typically read-only
        category: item.category || 'SNMP Traps'
      });
    });

    return tableItems;
  };

  useEffect(() => {
    const loadMIBData = async () => {
      try {
        setLoading(true);

        const response = await fetch('/files/mib.json');
        if (!response.ok) {
          throw new Error('Failed to fetch MIB data');
        }

        const mibJson = await response.json();
        setMibData(mibJson as MIBData);

        // Convert MIB data to table format
        const tableItems = convertMIBDataToTable(mibJson as MIBData);
        setTableData(tableItems);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error loading MIB data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMIBData();
  }, []);

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: { normal: string, hover: string } } = {
      'SNMP Configuration': { normal: 'bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300', hover: 'hover:bg-yellow-500/20 hover:text-yellow-800 dark:hover:bg-yellow-500/30 dark:hover:text-yellow-200' },
      'Main Data': { normal: 'bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300', hover: 'hover:bg-red-500/20 hover:text-red-800 dark:hover:bg-red-500/30 dark:hover:text-red-200' },
      'Cell Statistics': { normal: 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300', hover: 'hover:bg-indigo-500/20 hover:text-indigo-800 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-200' },
      'Environment Sensors': { normal: 'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300', hover: 'hover:bg-cyan-500/20 hover:text-cyan-800 dark:hover:bg-cyan-500/30 dark:hover:text-cyan-200' },
      'Protection Status': { normal: 'bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300', hover: 'hover:bg-orange-500/20 hover:text-orange-800 dark:hover:bg-orange-500/30 dark:hover:text-orange-200' },
      'Operational Status': { normal: 'bg-pink-500/10 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300', hover: 'hover:bg-pink-500/20 hover:text-pink-800 dark:hover:bg-pink-500/30 dark:hover:text-pink-200' },
      'SNMP Traps': { normal: 'bg-muted text-muted-foreground', hover: 'hover:bg-muted/80 hover:text-foreground' },
      'System Events': { normal: 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300', hover: 'hover:bg-purple-500/20 hover:text-purple-800 dark:hover:bg-purple-500/30 dark:hover:text-purple-200' },
    };
    return colors[category] || { normal: 'bg-muted text-muted-foreground', hover: 'hover:bg-muted/80 hover:text-foreground' };
  };

  const copyToClipboard = async (oid: string) => {
    try {
      await navigator.clipboard.writeText(oid);
      showToast.success('OID Copied', `${oid} has been copied to clipboard`);
    } catch (err) {
      showToast.error('Copy Failed', 'Unable to copy OID to clipboard');
      console.error('Failed to copy:', err);
    }
  };

  // Function to flatten MIB data for Excel export
  const flattenMIBDataForExcel = (mibData: MIBData) => {
    const flattenedData: any[] = [];

    // Flatten SNMP Configuration
    mibData.snmpConfiguration.forEach(item => {
      flattenedData.push({
        Section: 'SNMP Configuration',
        Name: item.objectName,
        OID: item.oid,
        Access: item.access,
        Category: 'Network Settings',
        Unit: '',
        Notes: item.description
      });
    });

    // Flatten Battery Data
    mibData.batteryData.forEach(item => {
      flattenedData.push({
        Section: 'Battery Data',
        Name: item.objectName,
        OID: item.oid,
        Access: item.access,
        Category: item.category,
        Unit: item.unit || '',
        Notes: item.notes || ''
      });
    });

    // Flatten System Events
    mibData.systemEvents.forEach(item => {
      flattenedData.push({
        Section: 'System Events',
        Name: item.eventName,
        OID: item.oid,
        Access: item.access,
        Category: item.category,
        Unit: item.unit || '',
        Notes: item.notes || ''
      });
    });

    // Flatten SNMP Traps
    mibData.snmpTraps.forEach(item => {
      flattenedData.push({
        Section: 'SNMP Traps',
        Name: item.trapName,
        OID: item.oid,
        Access: 'Read Only',
        Category: item.category,
        Unit: '',
        Notes: ''
      });
    });

    return flattenedData;
  };

  const exportMIBToExcel = () => {
    if (!mibData) return;

    const flattenedData = flattenMIBDataForExcel(mibData);
    const workbook = XLSX.utils.book_new();

    // Main data sheet
    const dataSheet = XLSX.utils.json_to_sheet(flattenedData);
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Complete MIB Data');

    // SNMP Configuration sheet
    const snmpSheet = XLSX.utils.json_to_sheet(mibData.snmpConfiguration);
    XLSX.utils.book_append_sheet(workbook, snmpSheet, 'SNMP Configuration');

    // Battery Data sheet
    const batterySheet = XLSX.utils.json_to_sheet(mibData.batteryData);
    XLSX.utils.book_append_sheet(workbook, batterySheet, 'Battery Data');

    // System Events sheet
    const eventsSheet = XLSX.utils.json_to_sheet(mibData.systemEvents);
    XLSX.utils.book_append_sheet(workbook, eventsSheet, 'System Events');

    // SNMP Traps sheet
    const trapsSheet = XLSX.utils.json_to_sheet(mibData.snmpTraps);
    XLSX.utils.book_append_sheet(workbook, trapsSheet, 'SNMP Traps');

    // Summary sheet
    const mibSummary = [
      { Section: 'SNMP Configuration', Count: mibData.snmpConfiguration.length },
      { Section: 'Battery Data', Count: mibData.batteryData.length },
      { Section: 'System Events', Count: mibData.systemEvents.length },
      { Section: 'SNMP Traps', Count: mibData.snmpTraps.length },
      { Section: 'Total Items', Count: flattenedData.length }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(mibSummary);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    XLSX.writeFile(workbook, `Complete_Battery_Management_System_MIB.xlsx`);
    showToast.success('Excel Downloaded', 'Complete MIB data exported successfully');
  };

  const exportToExcel = () => {
    if (!mibData) return;

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MIB Data');

    // Add MIB summary as a separate sheet
    const mibSummary = [
      { Property: 'SNMP Configuration Items', Value: mibData.snmpConfiguration.length },
      { Property: 'Battery Data Items', Value: mibData.batteryData.length },
      { Property: 'System Events Items', Value: mibData.systemEvents.length },
      { Property: 'SNMP Traps Items', Value: mibData.snmpTraps.length },
      { Property: 'Total MIB Items', Value: tableData.length }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(mibSummary);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    XLSX.writeFile(workbook, `Battery_Management_System_MIB_Data.xlsx`);
  };

  const exportToCSV = () => {
    if (!mibData) return;

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Battery_Management_System_MIB_Data.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <PageSkeleton
        title="SNMP MIB Data Configuration"
        icon={Database}
        showDeviceInfo={true}
        showTable={true}
        tableRows={10}
        showCards={false}
      />
    );
  }

  if (error || !mibData) {
    return (
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Database className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">SNMP MIB Data Configuration</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <div className="text-center text-destructive">
                <p className="text-lg font-semibold mb-2 text-foreground">Error Loading MIB Data</p>
                <p className="text-muted-foreground">{error || 'MIB data not available'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Database className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">SNMP MIB Data Configuration</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card className="mb-6 bg-card border border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-foreground">MIB Summary</CardTitle>
            <CardDescription className="text-muted-foreground">Battery Management System SNMP Objects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">SNMP Configuration</p>
                <p className="text-lg font-semibold text-foreground">{mibData.snmpConfiguration.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">Battery Data</p>
                <p className="text-lg font-semibold text-foreground">{mibData.batteryData.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">System Events</p>
                <p className="text-lg font-semibold text-foreground">{mibData.systemEvents.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">SNMP Traps</p>
                <p className="text-lg font-semibold text-foreground">{mibData.snmpTraps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MIB Downloader Section */}
        <MIBDownloader />

        <Card className="bg-card border border-border">
          <CardHeader className="border-b border-border">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-foreground">MIB Objects ({tableData.length} items)</CardTitle>
                <CardDescription className="text-muted-foreground">SNMP Management Information Base objects with their configurations</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportToCSV} variant="outline" size="sm" className="hover:bg-muted">
                  <FileText className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={exportToExcel} variant="outline" size="sm" className="hover:bg-muted">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Table
                </Button>
                <Button onClick={exportMIBToExcel} variant="default" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Full MIB Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-4 py-3 text-left font-semibold text-foreground">Variable Name</th>
                    <th className="border border-border px-4 py-3 text-left font-semibold text-foreground">OID</th>
                    <th className="border border-border px-4 py-3 text-left font-semibold text-foreground">Category</th>
                    <th className="border border-border px-4 py-3 text-left font-semibold text-foreground">Access</th>
                    <th className="border border-border px-4 py-3 text-left font-semibold text-foreground">Unit</th>
                    <th className="border border-border px-4 py-3 text-left font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((item: MIBTableItem, index: number) => {
                    const categoryColors = getCategoryColor(item.category);
                    return (
                      <tr key={index} className="hover:bg-muted/30 transition-colors">
                        <td className="border border-border px-4 py-3 font-medium text-foreground">
                          {item.var_name}
                        </td>
                        <td className="border border-border px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs bg-muted text-muted-foreground border-border">
                              {item.oid}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(item.oid)}
                              className="h-6 w-6 p-0 hover:bg-muted"
                              title="Copy OID to clipboard"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="border border-border px-4 py-3">
                          <Badge className={`${categoryColors.normal} ${categoryColors.hover} cursor-pointer transition-colors border-0`}>
                            {item.category}
                          </Badge>
                        </td>
                        <td className="border border-border px-4 py-3">
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            {item.access}
                          </Badge>
                        </td>
                        <td className="border border-border px-4 py-3">
                          {item.unit ? (
                            <Badge className="bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300">
                              {item.unit}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="border border-border px-4 py-3 text-sm text-muted-foreground">
                          {item.description || item.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3">Legend</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 border-0">SNMP Configuration</Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">Network Setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-0">Main Data</Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">Battery Measurements</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border-0">Cell Statistics</Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">Individual Cells</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border-0">Environment Sensors</Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">Environmental Data</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border-0">Protection Status</Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">Safety System</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-pink-500/10 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 border-0">Operational Status</Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">System Flags</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-0">System Events</Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">Event Notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-muted text-muted-foreground border-0">SNMP Traps</Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">Event Objects</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}
