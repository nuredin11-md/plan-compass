import { useState, useEffect, useMemo } from "react";
import { useDatabase, type HospitalPlanPerformance } from "@/hooks/useDatabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Download, Filter } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, exportToExcel } from "@/lib/exportUtils";

export default function HospitalPerformanceTab() {
  const { fetchHospitalPerformanceData, loading } = useDatabase();
  const [data, setData] = useState<HospitalPlanPerformance[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMetricType, setSelectedMetricType] = useState<string>("");

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      const result = await fetchHospitalPerformanceData({
        category: selectedCategory || undefined,
        fiscal_year: selectedYear || undefined,
        metric_type: selectedMetricType || undefined,
      });
      setData(result);
    };
    loadData();
  }, [selectedCategory, selectedYear, selectedMetricType, fetchHospitalPerformanceData]);

  // Get unique values for filters
  const categories = useMemo(() => [...new Set(data.map((d) => d.category))], [data]);
  const years = useMemo(() => [...new Set(data.map((d) => d.fiscal_year))].sort((a, b) => b.localeCompare(a)), [data]);
  const metricTypes = useMemo(() => [...new Set(data.map((d) => d.metric_type))], [data]);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    return data.filter((item) =>
      item.indicator_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.remark?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // Group data by indicator for display
  const groupedData = useMemo(() => {
    const groups: Record<string, HospitalPlanPerformance[]> = {};
    filteredData.forEach((item) => {
      const key = `${item.indicator_name}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredData]);

  const handleExportCSV = () => {
    try {
      const csvData = filteredData.map((item) => ({
        Category: item.category,
        "Indicator Name": item.indicator_name,
        "Fiscal Year": item.fiscal_year,
        "Metric Type": item.metric_type,
        "Metric Value": item.metric_value ?? "",
        "Percentage Value": item.percentage_value ?? "",
        Status: item.status,
        Remark: item.remark ?? "",
      }));
      exportToCSV(csvData, "hospital_performance.csv");
      toast.success("Data exported to CSV successfully!");
    } catch (error) {
      toast.error("Failed to export CSV");
      console.error(error);
    }
  };

  const handleExportExcel = () => {
    try {
      const excelData = filteredData.map((item) => ({
        Category: item.category,
        "Indicator Name": item.indicator_name,
        "Fiscal Year": item.fiscal_year,
        "Metric Type": item.metric_type,
        "Metric Value": item.metric_value ?? "",
        "Percentage Value": item.percentage_value ?? "",
        Status: item.status,
        Remark: item.remark ?? "",
      }));
      exportToExcel(excelData, "hospital_performance.xlsx");
      toast.success("Data exported to Excel successfully!");
    } catch (error) {
      toast.error("Failed to export Excel");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Hospital Plan & Performance</h2>
        <p className="text-muted-foreground">
          View and analyze hospital performance data by category, year, and metric type.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by indicator name, category, or remark..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fiscal Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Metric Type</label>
              <Select value={selectedMetricType} onValueChange={setSelectedMetricType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  {metricTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading}
            >
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading data...</span>
        </div>
      )}

      {/* Data Display */}
      {!loading && (
        <div className="space-y-6">
          {filteredData.length === 0 ? (
            <Card className="bg-slate-50/50 border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No data found matching your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Showing {filteredData.length} record{filteredData.length !== 1 ? "s" : ""} of {data.length}
              </div>

              {groupedData.map(([indicatorName, items]) => (
                <Card key={indicatorName}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{indicatorName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-semibold">Category</th>
                            <th className="text-left py-2 px-3 font-semibold">Fiscal Year</th>
                            <th className="text-left py-2 px-3 font-semibold">Metric Type</th>
                            <th className="text-right py-2 px-3 font-semibold">Value</th>
                            <th className="text-right py-2 px-3 font-semibold">Percentage</th>
                            <th className="text-left py-2 px-3 font-semibold">Status</th>
                            <th className="text-left py-2 px-3 font-semibold">Remark</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.id} className="border-b hover:bg-slate-50/50">
                              <td className="py-2 px-3">{item.category}</td>
                              <td className="py-2 px-3">{item.fiscal_year}</td>
                              <td className="py-2 px-3">
                                <Badge variant="outline">{item.metric_type}</Badge>
                              </td>
                              <td className="text-right py-2 px-3 font-medium">
                                {item.metric_value !== null ? item.metric_value.toFixed(2) : "—"}
                              </td>
                              <td className="text-right py-2 px-3 font-medium">
                                {item.percentage_value !== null ? `${item.percentage_value.toFixed(2)}%` : "—"}
                              </td>
                              <td className="py-2 px-3">
                                <Badge
                                  variant={item.status === "Active" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-xs text-muted-foreground max-w-xs truncate">
                                {item.remark || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
