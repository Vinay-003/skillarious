import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { InsertContent, InsertCourse, InsertDoubt, InsertEducator, InsertMessage, InsertModule, InsertReview, InsertTransaction, InsertUser } from '../src/db/schema.ts';

const assetRoot = fileURLToPath(new URL('../assets/demo/', import.meta.url));
const at = (key: string, contentType: string): DemoAsset => ({ key, path: `${assetRoot}/${key.slice('demo/v1/'.length)}`, contentType, public: contentType === 'image/png' });
export type DemoAsset = { key: string; path: string; contentType: string; public: boolean };
export const demoAssets: DemoAsset[] = [];
const slugs = ['programming', 'web', 'data', 'python', 'design', 'analytics'];
for (const slug of slugs) {
  demoAssets.push(at(`demo/v1/${slug}/thumbnail.png`, 'image/png'));
  for (const n of [1, 2]) {
    demoAssets.push(at(`demo/v1/${slug}/module-${n}-slide.mp4`, 'video/mp4'));
    demoAssets.push(at(`demo/v1/${slug}/module-${n}-notes.pdf`, 'application/pdf'));
  }
}

export const demoId = (key: string) => {
  const h = createHash('sha256').update(`skillarious-demo-v1:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const demoAccounts: { id: string; email: string; name: string; role: 'student' | 'educator' }[] = [
  ['alex', 'alex.educator@example.test', 'Alex Rivera', 'educator'], ['mira', 'mira.educator@example.test', 'Mira Chen', 'educator'], ['jonah', 'jonah.educator@example.test', 'Jonah Brooks', 'educator'],
  ['sam', 'sam.student@example.test', 'Sam Lee', 'student'], ['riley', 'riley.student@example.test', 'Riley Morgan', 'student'], ['taylor', 'taylor.student@example.test', 'Taylor Okafor', 'student'],
].map(([id, email, name, role]) => ({ id: demoId(`user/${id}`), email, name, role: role as 'student' | 'educator' }));

const date = (s: string) => new Date(`${s}T00:00:00Z`);
const user = (a: typeof demoAccounts[number], password: string): InsertUser => ({ id: a.id, name: a.name, email: a.email, password, verified: true, isEducator: a.role === 'educator', role: a.role, isAdmin: false, isBanned: false });
const ref = (key: string, refs: Record<string, string>) => refs[key] ?? (key.endsWith('.png') ? `https://demo.example.test/${key}` : `storage://course-content/${key}`);

export type DemoData = { users: InsertUser[]; educators: InsertEducator[]; categories: { id: string; name: string; description: string }[]; categoryCourses: { categoryId: string; courseId: string }[]; courses: InsertCourse[]; modules: InsertModule[]; content: InsertContent[]; transactions: InsertTransaction[]; reviews: InsertReview[]; doubts: InsertDoubt[]; messages: InsertMessage[] };
export function buildDemoData(passwordHash: string, assetReferences: Record<string, string>): DemoData {
  const users = demoAccounts.map(a => user(a, passwordHash));
  const educators = demoAccounts.filter(a => a.role === 'educator').map((a, i) => ({ id: demoId(`educator/${i}`), userId: a.id, bio: `Example educator for the ${['foundations', 'practice', 'applied'][i]} track.`, about: 'Demo profile with original instructional material.', doubtOpen: true }));
  const cats = ['Programming', 'Web Design', 'Data & Analytics'].map((name, i) => ({ id: demoId(`category/${i}`), name: `Demo ${name}`, description: 'Example category for the demo catalog.' }));
  const names = ['Programming Foundations Demo', 'Web Essentials Example Course', 'Data Literacy Demo', 'Python Practice Example', 'Interface Design Demo', 'Practical Analytics Example'];
  const prices = ['0', '0', '0', '19.00', '29.00', '39.00'];
  const courses: InsertCourse[] = names.map((name, i) => ({ id: demoId(`course/${i}`), educatorId: educators[i % 3].id, name, description: `An original demo course explaining ${name.replace(/ Demo| Example Course| Example/g, '').toLowerCase()} with concise slides and study exercises.`, about: 'Clearly labeled demonstration content, not a full narrated course.', start: date('2026-01-01'), end: date('2028-01-01'), price: prices[i], thumbnail: ref(`demo/v1/${slugs[i]}/thumbnail.png`, assetReferences), isDismissed: false, completionRate: 0, viewCount: 0 }));
  const categoryCourses = courses.map((c, i) => ({ categoryId: cats[i % 3]!.id, courseId: c.id! }));
  const modules: InsertModule[] = [], content: InsertContent[] = [];
  for (let i = 0; i < courses.length; i++) for (let m = 1; m <= 2; m++) { const mid = demoId(`module/${i}/${m}`); modules.push({ id: mid, courseId: courses[i]!.id!, name: `Module ${m}: ${m === 1 ? 'Core idea' : 'Practice lab'}`, duration: 5 / 60, videoCount: 1, materialCount: 1, isDismissed: false }); const base = `demo/v1/${slugs[i]}/module-${m}`; content.push({ id: demoId(`video/${i}/${m}`), moduleId: mid, title: 'Example demo slide lesson', description: 'A short original slide lesson; not narrated.', type: 'video', fileUrl: ref(`${base}-slide.mp4`, assetReferences), isDismissed: false, duration: '5', views: 0, order: 1, isPreview: true, createdAt: date('2026-01-01'), updatedAt: date('2026-01-01') }, { id: demoId(`pdf/${i}/${m}`), moduleId: mid, title: 'Original study note and exercise', description: 'Topic explanation and practice prompt.', type: 'application/pdf', fileUrl: ref(`${base}-notes.pdf`, assetReferences), isDismissed: false, duration: '0', views: 0, order: 2, isPreview: false, createdAt: date('2026-01-01'), updatedAt: date('2026-01-01') }); }
  const sam = demoAccounts.find(a => a.email.startsWith('sam'))!; const tx: InsertTransaction[] = [0, 1, 2].map(i => ({ id: demoId(`transaction/free/${i}`), userId: sam.id, courseId: courses[i]!.id!, amount: '0', date: date('2026-01-02'), status: 'completed', paymentId: 'DEMO_FREE_' + i })); tx.push({ id: demoId('transaction/grant'), userId: sam.id, courseId: courses[3]!.id!, amount: '0', date: date('2026-01-03'), status: 'completed', paymentId: 'DEMO_GRANT_PYTHON' });
  const reviews: InsertReview[] = courses.slice(0, 2).map((c, i) => ({ id: demoId(`review/${i}`), userId: sam.id, courseId: c.id, educatorId: c.educatorId, rating: 5, message: 'Demo feedback: clear examples and a useful exercise.', createdAt: date('2026-01-04') }));
  const doubtId = demoId('doubt/0'), contentId = content[0]!.id!; const doubts: InsertDoubt[] = [{ id: doubtId, message: 'How would I adapt this example to a larger dataset?', classId: contentId, date: date('2026-01-05'), educatorAssigned: educators[0]!.id, resolved: false, userId: sam.id, contentId, title: 'Demo question about the example', description: 'This is a demonstration doubt for the course discussion flow.', status: 'open' }];
  const messages: InsertMessage[] = [{ id: demoId('message/0'), doubtId, text: 'Demo educator reply: start by defining the input shape and checking missing values.', isResponse: true }];
  return { users, educators, categories: cats, categoryCourses, courses, modules, content, transactions: tx, reviews, doubts, messages };
}
