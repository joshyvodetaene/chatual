import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Wifi, WifiOff, RefreshCw, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/hooks/use-websocket';

interface ConnectionStatusIndicatorProps {
  connectionStatus: ConnectionStatus;
  lastError?: string | null;
  queuedCount?: number;
  failedCount?: number;
  isProcessingQueue?: boolean;
  onReconnect?: () => void;
  onClearFailed?: () => void;
}

export function ConnectionStatusIndicator({
  connectionStatus,
  lastError,
  queuedCount = 0,
  failedCount = 0,
  isProcessingQueue = false,
  onReconnect,
  onClearFailed,
}: ConnectionStatusIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          text: 'Connected',
          showDetails: queuedCount > 0 || failedCount > 0
        };
      case 'connecting':
        return {
          icon: RefreshCw,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          text: 'Connecting...',
          showDetails: true
        };
      case 'reconnecting':
        return {
          icon: RefreshCw,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          text: 'Reconnecting...',
          showDetails: true
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          text: 'Disconnected',
          showDetails: true
        };
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          text: 'Connection Error',
          showDetails: true
        };
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          text: 'Unknown',
          showDetails: false
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Don't show indicator if connected and no issues
  if (connectionStatus === 'connected' && queuedCount === 0 && failedCount === 0 && !lastError) {
    return null;
  }

  return (
    <div 
      className={cn(
        "border-l-4 p-3 rounded-r-md transition-all duration-200",
        config.bgColor,
        config.borderColor
      )}
      data-testid="connection-status-indicator"
    >
      {/* Main status line */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Icon 
            className={cn(
              "w-4 h-4", 
              config.color,
              (connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && "animate-spin"
            )} 
          />
          <span className={cn("text-sm font-medium", config.color)}>
            {config.text}
          </span>
          {isProcessingQueue && (
            <div className="flex items-center space-x-1">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
              <span className="text-xs text-blue-600">Processing queue</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Queue indicators */}
          {queuedCount > 0 && (
            <div className="flex items-center space-x-1 text-xs">
              <Clock className="w-3 h-3 text-orange-500" />
              <span className="text-orange-600">{queuedCount} queued</span>
            </div>
          )}
          
          {failedCount > 0 && (
            <div className="flex items-center space-x-1 text-xs">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-red-600">{failedCount} failed</span>
            </div>
          )}
          
          {config.showDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2 text-xs"
              data-testid="button-toggle-connection-details"
            >
              {isExpanded ? 'Hide' : 'Details'}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 space-y-2 border-t pt-2" data-testid="connection-details">
          {lastError && (
            <div className="text-xs text-gray-600">
              <strong>Error:</strong> {lastError}
            </div>
          )}
          
          {queuedCount > 0 && (
            <div className="text-xs text-orange-600">
              <strong>Queued Messages:</strong> {queuedCount} message{queuedCount !== 1 ? 's' : ''} waiting to be sent
            </div>
          )}
          
          {failedCount > 0 && (
            <div className="text-xs text-red-600">
              <strong>Failed Messages:</strong> {failedCount} message{failedCount !== 1 ? 's' : ''} could not be sent
            </div>
          )}
          
          <div className="flex space-x-2 pt-2">
            {(connectionStatus === 'disconnected' || connectionStatus === 'error') && onReconnect && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReconnect}
                className="h-7 px-3 text-xs"
                data-testid="button-reconnect"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Reconnect
              </Button>
            )}
            
            {failedCount > 0 && onClearFailed && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFailed}
                className="h-7 px-3 text-xs text-red-600 hover:text-red-700"
                data-testid="button-clear-failed"
              >
                Clear Failed
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}