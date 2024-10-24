import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import methodOverride from 'method-override';
import logger from 'morgan';
import errorHandler from 'errorhandler';
import st from 'st';
import marked from 'marked';
import fileUpload from 'express-fileupload';
import * as routes from './routes'; // Assuming routes are exported from routes.ts
import './db'; // Import the database connection

// Snyk setup (if needed)
// const snyk = require('@snyk/nodejs-runtime-agent');
// snyk({
//   projectId: process.env.SNYK_PROJECT_ID,
// });

const app = express();

// View engine setup
app.set('port', process.env.PORT || 3001);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(logger('dev'));
app.use(methodOverride());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

// Routes
app.use(routes.current_user);
app.get('/', routes.index);
app.get('/admin', routes.admin);
app.post('/admin', routes.admin);
app.post('/create', routes.create);
app.get('/destroy/:id', routes.destroy);
app.get('/edit/:id', routes.edit);
app.post('/update/:id', routes.update);
app.post('/import', routes.import);
app.get('/about_new', routes.about_new);
app.get('/chat', routes.chat.get);
app.put('/chat', routes.chat.add);
app.delete('/chat', routes.chat.delete);

// Static files
app.use(st({ path: './public', url: '/public' }));

// Markdown setup
marked.setOptions({ sanitize: true });
app.locals.marked = marked;

// Error handling (development only)
if (app.get('env') === 'development') {
  app.use(errorHandler());
}

// Token (consider storing securely)
const token = 'SECRET_TOKEN_f8ed84e8f41e4146403dd4a6bbcea5e418d23a9';
console.log('token: ' + token);

// Create and start the server
const server = http.createServer(app);
server.listen(app.get('port'), () => {
  console.log(`Express server listening on port ${app.get('port')}`);
});
