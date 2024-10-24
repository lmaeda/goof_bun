import express from 'express';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import hms from 'humanize-ms';
import ms from 'ms';
import streamBuffers from 'stream-buffers';
import readline from 'readline';
import moment from 'moment';
import { exec } from 'child_process';
import fileType from 'file-type';
import AdmZip from 'adm-zip';
import fs from 'fs';
import _ from 'lodash';

const utils = require('../utils'); // Assuming utils.js is already in TypeScript
const Todo = mongoose.model('Todo');
const User = mongoose.model('User');

interface TodoDocument extends mongoose.Document {
  content: string;
  updated_at: Date;
}

interface UserDocument extends mongoose.Document {
  name: string;
  password?: string;
  canDelete?: boolean;
}

interface Message {
  id: number;
  timestamp: number;
  userName: string;
  icon?: string;
  [key: string]: any; // Allow other properties
}

const users: UserDocument[] = [
  { name: 'user', password: 'pwd' },
  { name: 'admin', password: Math.random().toString(32), canDelete: true },
];

let messages: Message[] = [];
let lastId = 1;

function findUser(auth: { name?: string; password?: string }): UserDocument | undefined {
  return users.find((u) => u.name === auth.name && u.password === auth.password);
}

const index = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todos = await Todo.find({}).sort('-updated_at').exec();
    res.render('index', {
      title: 'Goof TODO',
      subhead: 'Vulnerabilities at their best',
      todos: todos,
    });
  } catch (err) {
    next(err);
  }
};

function parse(todo: string): string {
  let t = todo;
  const remindToken = ' in ';
  const reminder = t.indexOf(remindToken);
  if (reminder > 0) {
    let time = t.slice(reminder + remindToken.length);
    time = time.replace(/\n$/, '');
    const period = hms(time);
    console.log('period: ' + period);
    t = t.slice(0, reminder);
    if (typeof period !== 'undefined') {
      t += ` [${ms(period)}]`;
    }
  }
  return t;
}

const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let item = req.body.content;
    const imgRegex = /\!\[alt text\]\((http.*)\s\".*/;
    if (typeof item === 'string' && item.match(imgRegex)) {
      const url = item.match(imgRegex)[1];
      console.log('found img: ' + url);
      exec(`identify ${url}`, (err, stdout, stderr) => {
        console.log(err);
        if (err !== null) {
          console.log(`Error (${err}):${stderr}`);
        }
      });
    } else {
      item = parse(item);
    }

    const newTodo = await new Todo({
      content: item,
      updated_at: Date.now(),
    }).save();

    res.setHeader('Location', '/');
    res.status(302).send(newTodo.content.toString('base64'));
  } catch (err) {
    next(err);
  }
};

const destroy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (todo) {
      await todo.remove();
      res.redirect('/');
    } else {
      next(); // Handle case where todo is not found
    }
  } catch (err) {
    next(err);
  }
};

const edit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todos = await Todo.find({}).sort('-updated_at').exec();
    res.render('edit', {
      title: 'TODO',
      todos: todos,
      current: req.params.id,
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (todo) {
      todo.content = req.body.content;
      todo.updated_at = Date.now();
      await todo.save();
      res.redirect('/');
    } else {
      next(); // Handle case where todo is not found
    }
  } catch (err) {
    next(err);
  }
};

const current_user = (req: Request, res: Response, next: NextFunction) => {
  next();
};

function isBlank(str: string): boolean {
  return !str || /^\s*$/.test(str);
}

const importData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.files || !req.files.importFile) {
      res.send('No files were uploaded.');
      return;
    }

    const importFile = req.files.importFile;
    let data: string = '';

    const importedFileType = fileType(importFile.data);
    const zipFileExt = { ext: 'zip', mime: 'application/zip' };

    if (!importedFileType || importedFileType.mime === zipFileExt.mime) {
      const zip = new AdmZip(importFile.data);
      const extracted_path = '/tmp/extracted_files';
      zip.extractAllTo(extracted_path, true);

      try {
        data = fs.readFileSync('backup.txt', 'ascii');
      } catch (err) {
        console.error('Error reading backup.txt:', err);
        data = 'No backup.txt file found';
      }
    } else {
      data = importFile.data.toString('ascii');
    }

    const lines = data.split('\n');
    for (const line of lines) {
      const parts = line.split(',');
      let item = parts[0];
      const when = parts[1];
      const locale = parts[2];
      const format = parts[3];

      if (!isBlank(item)) {
        if (!isBlank(when) && !isBlank(locale) && !isBlank(format)) {
          console.log('setting locale ' + parts[1]);
          moment.locale(locale);
          const d = moment(when);
          console.log('formatting ' + d);
          item += ` [${d.format(format)}]`;
        }

        try {
          const newTodo = await new Todo({
            content: item,
            updated_at: Date.now(),
          }).save();
          console.log('added ' + newTodo);
        } catch (err) {
          console.error('Error saving todo:', err);
          // Consider handling the error more gracefully, e.g., sending an error response
        }
      }
    }

    res.redirect('/');
  } catch (err) {
    next(err);
  }
};

const about_new = (req: Request, res: Response, next: NextFunction) => {
  console.log(JSON.stringify(req.query));
  return res.render('about_new.dust', {
    title: 'Goof TODO',
    subhead: 'Vulnerabilities at their best',
    device: req.query.device,
  });
};

const chat = {
  get: (req: Request, res: Response) => {
    res.send(messages);
  },
  add: (req: Request, res: Response) => {
    const user = findUser(req.body.auth || {});
    if (!user) {
      return res.status(403).send({ ok: false, error: 'Access denied' });
    }

    const message: Message = {
      id: lastId++,
      timestamp: Date.now(),
      userName: user.name,
      icon: '👋', // Default icon
      ...req.body.message, // Merge with user-provided message data
    };

    messages.push(message);
    res.send({ ok: true });
  },
  delete: (req: Request, res: Response) => {
    const user = findUser(req.body.auth || {});
    if (!user || !user.canDelete) {
      return res.status(403).send({ ok: false, error: 'Access denied' });
    }

    messages = messages.filter((m) => m.id !== req.body.messageId);
    res.send({ ok: true });
  },
};

export {
  index,
  create,
  destroy,
  edit,
  update,
  current_user,
  importData,
  about_new,
  chat,
};
