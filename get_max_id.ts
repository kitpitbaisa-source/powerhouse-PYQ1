
import { mcqData } from './src/questions';
const maxId = Math.max(...mcqData.map(q => q.id));
console.log('Max ID:', maxId);
