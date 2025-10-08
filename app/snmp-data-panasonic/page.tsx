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
import { PanasonicMIBDownloader } from "@/components/PanasonicMIBDownloader";
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
  default?: string;
}

interface MIBTableItem {
  var_name: string;
  oid: string;
  access: string;
  category: string;
  unit?: string;
  description?: string;
  notes?: string;
  default?: string;
}

interface PanasonicMIBData {
  snmpConfiguration: MIBDataItem[];
  batteryStatus: MIBDataItem[];
  batteryData: MIBDataItem[];
  chargingParameters: MIBDataItem[];
  capacityData: MIBDataItem[];
  stateData: MIBDataItem[];
  voltageData: MIBDataItem[];
  currentData: MIBDataItem[];
  temperatureData: MIBDataItem[];
  individualCells: MIBDataItem[];
  statusFlags: MIBDataItem[];
  warningFlags: MIBDataItem[];
  alarmFlags: MIBDataItem[];
  errorFlags: MIBDataItem[];
}

export default function PanasonicBatteryPage() {
  const [mibData, setMibData] = useState<PanasonicMIBData | null>(null);
  const [tableData, setTableData] = useState<MIBTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to convert MIB data to table format
  const convertMIBDataToTable = (mibData: PanasonicMIBData): MIBTableItem[] => {
    const tableItems: MIBTableItem[] = [];

    // Convert all categories
    const categories = [
      { key: 'snmpConfiguration', prefix: 'SNMP Configuration' },
      { key: 'batteryStatus', prefix: 'Battery Status' },
      { key: 'batteryData', prefix: 'Battery Data' },
      { key: 'chargingParameters', prefix: 'Charging Parameters' },
      { key: 'capacityData', prefix: 'Capacity Data' },
      { key: 'stateData', prefix: 'State Data' },
      { key: 'voltageData', prefix: 'Voltage Data' },
      { key: 'currentData', prefix: 'Current Data' },
      { key: 'temperatureData', prefix: 'Temperature Data' },
      { key: 'individualCells', prefix: 'Individual Cells' },
      { key: 'statusFlags', prefix: 'Status Flags' },
      { key: 'warningFlags', prefix: 'Warning Flags' },
      { key: 'alarmFlags', prefix: 'Alarm Flags' },
      { key: 'errorFlags', prefix: 'Error Flags' }
    ];

    categories.forEach(({ key, prefix }) => {
      const categoryData = mibData[key as keyof PanasonicMIBData] as MIBDataItem[];
      categoryData.forEach(item => {
        tableItems.push({
          var_name: item.objectName || item.eventName || item.trapName || 'Unknown',
          oid: item.oid,
          access: item.access,
          category: item.category || prefix,
          unit: item.unit,
          description: item.description,
          notes: item.notes,
          default: item.default
        });
      });
    });

    return tableItems;
  };

  useEffect(() => {
    const loadMIBData = async () => {
      try {
        setLoading(true);

        const response = await fetch('/files/GSPE_PANASONIC_MIB_v1_1.mib');
        if (!response.ok) {
          throw new Error('Failed to fetch MIB data');
        }
        // Since MIB is not JSON, we load from local JSON file instead
        const localResponse = await fetch('/files/mib-panasonic.json');
        if (!localResponse.ok) {
          throw new Error('Failed to fetch Panasonic MIB data');
        }

        const mibJson = await localResponse.json();
        setMibData(mibJson as PanasonicMIBData);

        // Convert MIB data to table format
        const tableItems = convertMIBDataToTable(mibJson as PanasonicMIBData);
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
      'Battery Status': { normal: 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', hover: 'hover:bg-blue-500/20 hover:text-blue-800 dark:hover:bg-blue-500/30 dark:hover:text-blue-200' },
      'Battery Data': { normal: 'bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300', hover: 'hover:bg-green-500/20 hover:text-green-800 dark:hover:bg-green-500/30 dark:hover:text-green-200' },
      'Charging Parameters': { normal: 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300', hover: 'hover:bg-purple-500/20 hover:text-purple-800 dark:hover:bg-purple-500/30 dark:hover:text-purple-200' },
      'Capacity Data': { normal: 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300', hover: 'hover:bg-indigo-500/20 hover:text-indigo-800 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-200' },
      'State Data': { normal: 'bg-pink-500/10 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300', hover: 'hover:bg-pink-500/20 hover:text-pink-800 dark:hover:bg-pink-500/30 dark:hover:text-pink-200' },
      'Voltage Data': { normal: 'bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300', hover: 'hover:bg-cyan-500/20 hover:text-cyan-800 dark:hover:bg-cyan-500/30 dark:hover:text-cyan-200' },
      'Current Data': { normal: 'bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300', hover: 'hover:bg-orange-500/20 hover:text-orange-800 dark:hover:bg-orange-500/30 dark:hover:text-orange-200' },
      'Temperature Data': { normal: 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300', hover: 'hover:bg-rose-500/20 hover:text-rose-800 dark:hover:bg-rose-500/30 dark:hover:text-rose-200' },
      'Individual Cells': { normal: 'bg-teal-500/10 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300', hover: 'hover:bg-teal-500/20 hover:text-teal-800 dark:hover:bg-teal-500/30 dark:hover:text-teal-200' },
      'Status Flags': { normal: 'bg-lime-500/10 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300', hover: 'hover:bg-lime-500/20 hover:text-lime-800 dark:hover:bg-lime-500/30 dark:hover:text-lime-200' },
      'Warning Flags': { normal: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', hover: 'hover:bg-amber-500/20 hover:text-amber-800 dark:hover:bg-amber-500/30 dark:hover:text-amber-200' },
      'Alarm Flags': { normal: 'bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300', hover: 'hover:bg-red-500/20 hover:text-red-800 dark:hover:bg-red-500/30 dark:hover:text-red-200' },
      'Error Flags': { normal: 'bg-slate-500/10 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300', hover: 'hover:bg-slate-500/20 hover:text-slate-800 dark:hover:bg-slate-500/30 dark:hover:text-slate-200' },
    };
    return colors[category] || { normal: 'bg-muted text-muted-foreground', hover: 'hover:bg-muted/80 hover:text-foreground' };
  };

  const copyToClipboard = async (oid: string) => {
    try {
      await navigator.clipboard.writeText(oid);
      showToast.success('OID Copied', `${oid} has been copied to clipboard`);
    } catch (err) {
      // Fallback untuk browsers yang tidak mendukung clipboard atau HTTP
      try {
        // Fallback untuk IE dan mobile browsers
        const textArea = document.createElement('textarea');
        textArea.value = oid;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        showToast.success('OID Copied', `${oid} has been copied to clipboard (fallback method)`);
      } catch (fallbackErr) {
        showToast.error('Copy Failed', 'Unable to copy OID to clipboard. Please copy manually.');
        console.error('Failed to copy:', err, fallbackErr);
      }
    }
  };

  // Function to flatten MIB data for Excel export
  const flattenMIBDataForExcel = (mibData: PanasonicMIBData) => {
    const flattenedData: any[] = [];

    const categories = [
      { key: 'snmpConfiguration', prefix: 'SNMP Configuration' },
      { key: 'batteryStatus', prefix: 'Battery Status' },
      { key: 'batteryData', prefix: 'Battery Data' },
      { key: 'chargingParameters', prefix: 'Charging Parameters' },
      { key: 'capacityData', prefix: 'Capacity Data' },
      { key: 'stateData', prefix: 'State Data' },
      { key: 'voltageData', prefix: 'Voltage Data' },
      { key: 'currentData', prefix: 'Current Data' },
      { key: 'temperatureData', prefix: 'Temperature Data' },
      { key: 'individualCells', prefix: 'Individual Cells' },
      { key: 'statusFlags', prefix: 'Status Flags' },
      { key: 'warningFlags', prefix: 'Warning Flags' },
      { key: 'alarmFlags', prefix: 'Alarm Flags' },
      { key: 'errorFlags', prefix: 'Error Flags' }
    ];

    categories.forEach(({ key, prefix }) => {
      const categoryData = mibData[key as keyof PanasonicMIBData] as MIBDataItem[];
      categoryData.forEach(item => {
        flattenedData.push({
          Section: prefix,
          Name: item.objectName || item.eventName || item.trapName,
          OID: item.oid,
          Access: item.access,
          Category: item.category || prefix,
          Unit: item.unit || '',
          Description: item.description || '',
          Notes: item.notes || '',
          Default: item.default || ''
        });
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
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Complete Panasonic MIB Data');

    // Individual category sheets
    const categories = [
      { key: 'snmpConfiguration', name: 'SNMP Configuration' },
      { key: 'batteryStatus', name: 'Battery Status' },
      { key: 'batteryData', name: 'Battery Data' },
      { key: 'chargingParameters', name: 'Charging Parameters' },
      { key: 'capacityData', name: 'Capacity Data' },
      { key: 'stateData', name: 'State Data' },
      { key: 'voltageData', name: 'Voltage Data' },
      { key: 'currentData', name: 'Current Data' },
      { key: 'temperatureData', name: 'Temperature Data' },
      { key: 'individualCells', name: 'Individual Cells' },
      { key: 'statusFlags', name: 'Status Flags' },
      { key: 'warningFlags', name: 'Warning Flags' },
      { key: 'alarmFlags', name: 'Alarm Flags' },
      { key: 'errorFlags', name: 'Error Flags' }
    ];

    categories.forEach(({ key, name }) => {
      const categoryData = mibData[key as keyof PanasonicMIBData] as MIBDataItem[];
      const sheet = XLSX.utils.json_to_sheet(categoryData);
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    });

    // Summary sheet
    const mibSummary = categories.map(({ key, name }) => ({
      Section: name,
      Count: (mibData[key as keyof PanasonicMIBData] as MIBDataItem[]).length
    }));
    mibSummary.push({
      Section: 'Total Items',
      Count: flattenedData.length
    } as any);
    const summarySheet = XLSX.utils.json_to_sheet(mibSummary);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    XLSX.writeFile(workbook, `Panasonic_DCB105ZK_Battery_MIB.xlsx`);
    showToast.success('Excel Downloaded', 'Complete Panasonic MIB data exported successfully');
  };

  const exportToExcel = () => {
    if (!mibData) return;

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MIB Data');

    // Add MIB summary as a separate sheet
    const mibSummary = [
      { Property: 'SNMP Configuration Items', Value: mibData.snmpConfiguration.length },
      { Property: 'Battery Data Items', Value: mibData.batteryStatus.length + mibData.chargingParameters.length + mibData.capacityData.length + mibData.stateData.length },
      { Property: 'Voltage & Current Items', Value: mibData.voltageData.length + mibData.currentData.length },
      { Property: 'Temperature Items', Value: mibData.temperatureData.length },
      { Property: 'Individual Cell Items', Value: mibData.individualCells.length },
      { Property: 'Status/Alerts/Flags Items', Value: mibData.statusFlags.length + mibData.warningFlags.length + mibData.alarmFlags.length + mibData.errorFlags.length },
      { Property: 'Total MIB Items', Value: tableData.length }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(mibSummary);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    XLSX.writeFile(workbook, `Panasonic_DCB105ZK_Battery_MIB_Data.xlsx`);
  };

  const exportToCSV = () => {
    if (!mibData) return;

    const worksheet = XLSX.utils.json_to_sheet(tableData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Panasonic_DCB105ZK_Battery_MIB_Data.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <PageSkeleton
        title="Panasonic DCB105ZK SNMP MIB Data"
        icon={Database}
        showDeviceInfo={true}
        showTable={true}
        tableRows={20}
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
          <h1 className="text-lg font-semibold text-foreground">Panasonic DCB105ZK SNMP MIB Data</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card className="bg-card border border-border">
            <CardContent className="p-6">
              <div className="text-center text-destructive">
                <p className="text-lg font-semibold mb-2 text-foreground">Error Loading MIB Data</p>
                <p className="text-muted-foreground">{error || 'Panasonic MIB data not available'}</p>
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
        <h1 className="text-lg font-semibold text-foreground">Panasonic DCB105ZK SNMP MIB Data</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card className="mb-6 bg-card border border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-foreground">Panasonic DCB105ZK Battery MIB Summary</CardTitle>
            <CardDescription className="text-muted-foreground">Comprehensive BMS monitoring with 13S lithium-ion battery support</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">SNMP Config</p>
                <p className="text-lg font-semibold text-foreground">{mibData.snmpConfiguration.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">Status Registers</p>
                <p className="text-lg font-semibold text-foreground">{mibData.batteryStatus.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">State & Capacity</p>
                <p className="text-lg font-semibold text-foreground">{mibData.stateData.length + mibData.capacityData.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">V/I/T Data</p>
                <p className="text-lg font-semibold text-foreground">{mibData.voltageData.length + mibData.currentData.length + mibData.temperatureData.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">Individual Cells</p>
                <p className="text-lg font-semibold text-foreground">{mibData.individualCells.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">Flags & Alerts</p>
                <p className="text-lg font-semibold text-foreground">{mibData.statusFlags.length + mibData.warningFlags.length + mibData.alarmFlags.length + mibData.errorFlags.length}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-lg font-semibold text-foreground">{tableData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MIB Downloader Section */}
        <PanasonicMIBDownloader />

        <Card className="bg-card border border-border">
          <CardHeader className="border-b border-border">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-foreground">Panasonic DCB105ZK MIB Objects ({tableData.length} items)</CardTitle>
                <CardDescription className="text-muted-foreground">Complete SNMP management objects for Panasonic DCB105ZK lithium-ion battery monitoring</CardDescription>
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
                    <th className="border border-border px-4 py-3 text-left font-semibold text-foreground">Default</th>
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
                        <td className="border border-border px-4 py-3 text-sm">
                          {item.default ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {item.default}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border">
              <h3 className="text-lg font-semibold text-foreground mb-3">Panasonic DCB105ZK Features Legend</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 border-0">SNMP Configuration</Badge>
                  <span className="text-sm text-muted-foreground hidden lg:inline">Network Setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-0">Status Registers</Badge>
                  <span className="text-sm text-muted-foreground hidden lg:inline">Bitmask States</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-0">Battery Data</Badge>
                  <span className="text-sm text-muted-foreground hidden lg:inline">Device Info</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-0">Charging</Badge>
                  <span className="text-sm text-muted-foreground hidden lg:inline">Charge Params</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-teal-500/10 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 border-0">Individual Cells</Badge>
                  <span className="text-sm text-muted-foreground hidden lg:inline">13S Monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-0">Alarm Flags</Badge>
                  <span className="text-sm text-muted-foreground hidden lg:inline">Protection</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-0">Warning Flags</Badge>
                  <span className="text-sm text-muted-foreground hidden lg:inline">Alerts</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Panasonic DCB105ZK MIB:</strong> 139+ parameters including 13S individual cell monitoring,
                  comprehensive protection flags, dual value formats (scaled + real), and advanced trap definitions for
                  complete BMS monitoring and management.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}
