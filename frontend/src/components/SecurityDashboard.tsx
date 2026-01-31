import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Activity, RefreshCw, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { useToast } from './ui/use-toast';
import { api, getApiUrl } from '../utils/api';

interface SecurityEvent {
  id: number;
  type: 'credential_attack' | 'credential_stuffing' | 'enumeration' |
        'rate_limit_abuse' | 'off_hours_access' | 'geographic_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ip_address: string;
  endpoint: string;
  description: string;
  metadata: any;
  created_at: number;
}

interface SecurityStats {
  last_24h: {
    total_events: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    unique_ips: number;
  };
  last_7d: {
    total_events: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  top_threats_24h: Array<{ type: string; count: number }>;
  top_ips_24h: Array<{ ip_address: string; event_count: number }>;
}

export function SecurityDashboard() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const { toast } = useToast();

  const apiUrl = getApiUrl();

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [filter]);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    try {
      await Promise.all([
        fetchEvents(),
        fetchStats()
      ]);
    } catch (error) {
      if (!silent) {
        toast({
          variant: 'destructive',
          title: 'Failed to load security data',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchEvents() {
    try {
      const url = filter === 'all'
        ? `${apiUrl}/security/events?limit=100`
        : `${apiUrl}/security/events?severity=${filter}&limit=100`;

      const data = await api.get<{ events: SecurityEvent[]; count: number }>(url);
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch security events:', error);
      throw error;
    }
  }

  async function fetchStats() {
    try {
      const data = await api.get<SecurityStats>(`${apiUrl}/security/stats`);
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch security stats:', error);
      throw error;
    }
  }

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getSeverityVariant = (severity: string): "default" | "destructive" | "warning" | "success" | "secondary" => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const threatTypeLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">Monitor security events and threats in real-time</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.last_24h.total_events || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days: {stats?.last_7d.total_events || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.last_24h.critical || 0}</div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats?.last_24h.high || 0}</div>
            <p className="text-xs text-muted-foreground">
              Should be reviewed soon
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium & Low</CardTitle>
            <Shield className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {(stats?.last_24h.medium || 0) + (stats?.last_24h.low || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              For investigation
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Threats */}
      {stats?.top_threats_24h && stats.top_threats_24h.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Threats (Last 24h)</CardTitle>
            <CardDescription>Most common threat types detected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.top_threats_24h.map((threat, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{threatTypeLabel(threat.type)}</span>
                  <span className="text-sm font-medium">{threat.count} events</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          size="sm"
        >
          All Events
        </Button>
        <Button
          variant={filter === 'critical' ? 'default' : 'outline'}
          onClick={() => setFilter('critical')}
          size="sm"
          className={filter === 'critical' ? 'bg-red-500 hover:bg-red-600' : ''}
        >
          Critical
        </Button>
        <Button
          variant={filter === 'high' ? 'default' : 'outline'}
          onClick={() => setFilter('high')}
          size="sm"
          className={filter === 'high' ? 'bg-orange-500 hover:bg-orange-600' : ''}
        >
          High
        </Button>
        <Button
          variant={filter === 'medium' ? 'default' : 'outline'}
          onClick={() => setFilter('medium')}
          size="sm"
          className={filter === 'medium' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
        >
          Medium
        </Button>
        <Button
          variant={filter === 'low' ? 'default' : 'outline'}
          onClick={() => setFilter('low')}
          size="sm"
          className={filter === 'low' ? 'bg-blue-500 hover:bg-blue-600' : ''}
        >
          Low
        </Button>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Security Events</CardTitle>
          <CardDescription>
            {events.length} event{events.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No security events found</p>
              <p className="text-sm">This is good news!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-sm">
                      {new Date(event.created_at * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityVariant(event.severity)}>
                        {event.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{threatTypeLabel(event.type)}</TableCell>
                    <TableCell className="text-sm font-mono">{event.ip_address}</TableCell>
                    <TableCell className="text-sm max-w-md truncate" title={event.description}>
                      {event.description}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Security Event Details</DialogTitle>
            <DialogDescription>Event ID: {selectedEvent?.id}</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Timestamp</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedEvent.created_at * 1000).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Severity</label>
                <p>
                  <Badge variant={getSeverityVariant(selectedEvent.severity)}>
                    {selectedEvent.severity.toUpperCase()}
                  </Badge>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Threat Type</label>
                <p className="text-sm text-muted-foreground">{threatTypeLabel(selectedEvent.type)}</p>
              </div>

              <div>
                <label className="text-sm font-medium">IP Address</label>
                <p className="text-sm text-muted-foreground font-mono">{selectedEvent.ip_address}</p>
              </div>

              <div>
                <label className="text-sm font-medium">Endpoint</label>
                <p className="text-sm text-muted-foreground font-mono">{selectedEvent.endpoint}</p>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
              </div>

              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div>
                  <label className="text-sm font-medium">Additional Details</label>
                  <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-x-auto">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <Button onClick={() => setSelectedEvent(null)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
