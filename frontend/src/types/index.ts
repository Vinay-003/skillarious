// User related types
export interface User {
  id: string;
  name: string;
  email: string;
  pfp?: string;
  phone?: string;
  gender?: string;
  age?: number;
  isEducator: boolean;
  verified: boolean;
  refreshToken?: string;
  isAdmin: boolean;
  role: 'user' | 'educator' | 'admin';
  isBanned: boolean;
  banReason?: string;
  bannedAt?: Date;
  lastLogin?: Date;
}

// OTP related types
export interface OTP {
  id: string;
  value: number;
  email: string;
  expiry: Date;
  lastSent: Date;
}

// Educator related types
export interface Educator {
  id: string;
  userId: string;
  bio?: string;
  about?: string;
  doubtOpen: boolean;
  expertise?: string;
  qualification?: string;
  experience?: number;
  socialLinks?: {
    website?: string;
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
  rating?: number;
  totalStudents?: number;
  totalCourses?: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Course related types
export interface Course {
  id: string;
  name: string;
  description: string;
  about: string;
  price: number;
  thumbnail: string;
  educatorId: string;
  educatorName?: string;
  educatorPfp?: string | null;
  viewcount: number;
  start: Date;
  end: Date;
}

export interface CourseCreateInput {
  name: string;
  description: string;
  about: string;
  price: number;
  thumbnail?: File;
  categoryId?: string;
}

export interface CourseUpdateInput extends Partial<CourseCreateInput> {
  id: string;
}

// Category related types
export interface Category {
  id: string;
  name: string;
  description?: string;
  coursesCount?: number;
}

// CategoryCourses relation type
export interface CategoryCourse {
  categoryId: string;
  courseId: string;
}

// Module related types
export interface Module {
  [x: string]: string;
  id: string;
  name: string;
  duration?: number;
  videoCount?: number;
  materialCount?: number;
  courseId: string;
  createdAt?: string;
  updatedAt?: string;
}

// Class related types
export interface Class {
  [x: string]: number;
  title: string;
  description: string;
  videoUrl: string;
  materialUrl: string;
  startDate: string | number | Date;
  endDate: string | number | Date;
  name: ReactNode;
  id: string;
  moduleId: string;
  views?: number;
  duration?: Date;
  fileId?: string;
  fileUrl?: string;
}

// Content related types
export interface StudyMaterial {
  id: string;
  moduleId: string;
  title: string;
  description?: string;
  order: number;
  fileUrl: string;
  type: string;
  isPreview: boolean;
  views?: number;
  isDismissed?: boolean;
  dismissReason?: string;
  dismissedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Review related types
export interface Review {
  id: string;
  rating: number;
  message: string;
  createdAt: string;
  userId: string;
  courseId: string;
}

// Transaction related types
export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  date: Date;
  courseId: string;
  status: string;
  paymentId: string;
  refundReason?: string;
  refundDate?: Date;
}

// File related types
export interface File {
  id: string;
  owner: string;
  name?: string;
  uploaded: Date;
  link: string;
  type: string;
}

// Doubt related types
export interface Doubt {
  id: string;
  fileId?: string;
  message: string;
  classId?: string;
  date: Date;
  educatorAssigned?: string;
  resolved: boolean;
  userId: string;
  contentId: string;
  title: string;
  description: string;
  status: string;
}

// Message related types
export interface Message {
  id: string;
  doubtId: string;
  text: string;
  isResponse: boolean;
}

// Profile related types
export interface Profile {
    name: string;
    email: string;
    phone: string;
    age: number;
    gender: string;
    pfp: string;
}

//

// Admin Log related types
export interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  metadata?: any;
  createdAt: Date;
}















