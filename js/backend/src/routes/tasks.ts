import { Router } from 'express';
import { ApiResponse } from '@app/shared';
import { AppError } from '../middleware/errorHandler';

const router = Router();

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tasks: Task[] = [
  {
    id: '1',
    title: 'Setup project infrastructure',
    description: 'Initialize the basic project structure and development tooling',
    completed: true,
    createdAt: new Date('2025-08-01'),
    updatedAt: new Date('2025-08-01'),
  },
  {
    id: '2',
    title: 'Implement user authentication',
    description: 'Create login/logout functionality and user management',
    completed: false,
    createdAt: new Date('2025-08-02'),
    updatedAt: new Date('2025-08-02'),
  },
];

router.get('/', (req, res) => {
  const response: ApiResponse<Task[]> = {
    success: true,
    data: tasks,
  };
  res.json(response);
});

router.get('/:id', (req, res, next) => {
  const task = tasks.find((t) => t.id === req.params.id);

  if (!task) {
    return next(new AppError(404, 'Task not found'));
  }

  const response: ApiResponse<Task> = {
    success: true,
    data: task,
  };
  res.json(response);
});

router.post('/', (req, res, next) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return next(new AppError(400, 'Title and description are required'));
  }

  const newTask: Task = {
    id: Date.now().toString(),
    title,
    description,
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  tasks.push(newTask);

  const response: ApiResponse<Task> = {
    success: true,
    data: newTask,
    message: 'Task created successfully',
  };
  res.status(201).json(response);
});

router.put('/:id', (req, res, next) => {
  const taskIndex = tasks.findIndex((t) => t.id === req.params.id);

  if (taskIndex === -1) {
    return next(new AppError(404, 'Task not found'));
  }

  const { title, description, completed } = req.body;

  if (title) tasks[taskIndex].title = title;
  if (description) tasks[taskIndex].description = description;
  if (typeof completed === 'boolean') tasks[taskIndex].completed = completed;
  tasks[taskIndex].updatedAt = new Date();

  const response: ApiResponse<Task> = {
    success: true,
    data: tasks[taskIndex],
    message: 'Task updated successfully',
  };
  res.json(response);
});

router.delete('/:id', (req, res, next) => {
  const taskIndex = tasks.findIndex((t) => t.id === req.params.id);

  if (taskIndex === -1) {
    return next(new AppError(404, 'Task not found'));
  }

  tasks.splice(taskIndex, 1);

  const response: ApiResponse = {
    success: true,
    message: 'Task deleted successfully',
  };
  res.json(response);
});

export default router;