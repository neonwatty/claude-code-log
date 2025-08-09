import { Router, Request, Response } from 'express';
import FileSystemMonitor from '../services/fileSystemMonitor';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role?: string;
  };
}

/**
 * GET /api/file-monitoring/status
 * Get current file monitoring status
 */
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileSystemMonitor = req.app.locals.fileSystemMonitor as FileSystemMonitor | null;
    
    if (!fileSystemMonitor) {
      return res.json({
        enabled: false,
        message: 'File system monitoring is not enabled'
      });
    }

    const status = fileSystemMonitor.getStatus();
    res.json({
      enabled: true,
      status
    });
  } catch (error) {
    console.error('Error getting file monitoring status:', error);
    res.status(500).json({
      error: 'Failed to get file monitoring status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/file-monitoring/rescan
 * Manually trigger a rescan of all watched directories
 */
router.post('/rescan', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileSystemMonitor = req.app.locals.fileSystemMonitor as FileSystemMonitor | null;
    
    if (!fileSystemMonitor) {
      return res.status(400).json({
        error: 'File system monitoring is not enabled'
      });
    }

    await fileSystemMonitor.rescan();
    
    res.json({
      success: true,
      message: 'Rescan completed successfully'
    });
  } catch (error) {
    console.error('Error rescanning directories:', error);
    res.status(500).json({
      error: 'Failed to rescan directories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/file-monitoring/watch-path
 * Add a new path to monitor
 */
router.post('/watch-path', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path } = req.body;
    
    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        error: 'Path is required and must be a string'
      });
    }

    const fileSystemMonitor = req.app.locals.fileSystemMonitor as FileSystemMonitor | null;
    
    if (!fileSystemMonitor) {
      return res.status(400).json({
        error: 'File system monitoring is not enabled'
      });
    }

    await fileSystemMonitor.addWatchPath(path);
    
    res.json({
      success: true,
      message: `Added watch path: ${path}`,
      status: fileSystemMonitor.getStatus()
    });
  } catch (error) {
    console.error('Error adding watch path:', error);
    res.status(500).json({
      error: 'Failed to add watch path',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/file-monitoring/watch-path
 * Remove a path from monitoring
 */
router.delete('/watch-path', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { path } = req.body;
    
    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        error: 'Path is required and must be a string'
      });
    }

    const fileSystemMonitor = req.app.locals.fileSystemMonitor as FileSystemMonitor | null;
    
    if (!fileSystemMonitor) {
      return res.status(400).json({
        error: 'File system monitoring is not enabled'
      });
    }

    fileSystemMonitor.removeWatchPath(path);
    
    res.json({
      success: true,
      message: `Removed watch path: ${path}`,
      status: fileSystemMonitor.getStatus()
    });
  } catch (error) {
    console.error('Error removing watch path:', error);
    res.status(500).json({
      error: 'Failed to remove watch path',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;