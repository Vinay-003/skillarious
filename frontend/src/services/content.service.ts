import axios from 'axios';
import authService from './auth.service';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

class ContentService {
    // Instance methods
    async createModule(courseId: string, moduleData: any) {
        const response = await axios.post(`${API_URL}/content/createModule`, {
            courseId,
            ...moduleData
        }, {
            headers: {
                'Authorization': `Bearer ${authService.getAccessToken()}`
            }
        });
        return response.data;
    }

    async updateModule(moduleId: string, moduleData: any) {
        try {
            const response = await axios.put(`${API_URL}/content/updateModule/${moduleId}`, moduleData, {
                headers: {
                    'Authorization': `Bearer ${authService.getAccessToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Update module error:', error.response?.data);
                throw error;
            }
            throw error;
        }
    }

    async getAllModules(courseId: string) {
        try {
            const response = await axios.get(`${API_URL}/content/getAllModules/${courseId}`, {
                headers: {
                    Authorization: `Bearer ${authService.getAccessToken()}`
                }
            });
            return {
                success: true,
                message: 'Modules retrieved successfully',
                data: Array.isArray(response.data.data) ? response.data.data : []
            };
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                switch (error.response?.status) {
                    case 404:
                        return {
                            success: false,
                            message: 'No modules found for this course',
                            data: []
                        };
                    // ... other cases
                }
            }
            throw error;
        }
    }

    async getModuleStudyMaterials(moduleId: string) {
        try {
            await authService.validateSession();
            const freshToken = authService.getAccessToken();
            
            // The endpoint should match your backend route
            const response = await axios.get(
                `${API_URL}/content/getModuleStudyMaterials/${moduleId}`, // Changed from moduleStudyMaterials to getModuleStudyMaterials
                {
                    headers: {
                        'Authorization': `Bearer ${freshToken}`
                    }
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('Get study materials error:', error.response?.data || error);
            throw error;
        }
    }

    async getStudyMaterialUrl(materialId: string) {
        const response = await axios.get(`${API_URL}/content/getStudyMaterialUrl/${materialId}`, {
            headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
        });
        return response.data;
    }

    async createClass(
        moduleId: string, 
        formData: FormData,
        onProgress?: (progress: number) => void
    ) {
        try {
            await authService.validateSession();
            const freshToken = authService.getAccessToken();

            const response = await axios.post(
                `${API_URL}/content/class/${moduleId}`, // Updated endpoint
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${freshToken}`,
                        'Content-Type': 'multipart/form-data'
                    },
                    onUploadProgress: (progressEvent) => {
                        if (onProgress && progressEvent.total) {
                            const progress = (progressEvent.loaded / progressEvent.total) * 100;
                            onProgress(progress);
                        }
                    }
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('Create class error:', error.response?.data || error);
            throw error;
        }
    }

    async getAllClasses(courseId: string) {
        try {
            const response = await axios.get(`${API_URL}/content/getAllClassesOfCourse/${courseId}`, {
                headers: {
                    'Authorization': `Bearer ${authService.getAccessToken()}`
                }
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error fetching classes:', error.response?.data);
                throw error;
            }
            throw error;
        }
    }

    async getModuleClasses(moduleId: string) {
        try {
            const response = await axios.get(`${API_URL}/content/getModuleClasses/${moduleId}`, {
                headers: {
                    'Authorization': `Bearer ${authService.getAccessToken()}`
                }
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Error fetching module classes:', error.response?.data);
                throw error;
            }
            throw error;
        }
    }

    async getClassStreamUrl(contentId: string) {
        const response = await axios.get(`${API_URL}/content/getClassStreamUrl/${contentId}`, {
            headers: { Authorization: `Bearer ${authService.getAccessToken()}` }
        });
        return response.data;
    }

    async updateClass(
        classId: string, 
        formData: FormData,
        onProgress?: (progress: number) => void
    ) {
        try {
            const response = await axios.put(
                `${API_URL}/content/class/${classId}`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    onUploadProgress: (progressEvent) => {
                        if (onProgress && progressEvent.total) {
                            const progress = (progressEvent.loaded / progressEvent.total) * 100;
                            onProgress(progress);
                        }
                    }
                }
            );
            return response.data;
        } catch (error: any) {
            throw new Error(error.response?.data?.message || 'Failed to update class');
        }
    }

    async deleteClass(contentId: string) {
        try {
            const response = await axios.delete(
                `${API_URL}/content/deleteClass/${contentId}`,  // Updated to match backend route
                {
                    headers: {
                        'Authorization': `Bearer ${this.getToken()}`
                    }
                }
            );
            
            if (response.data.success === false) {
                throw new Error(response.data.message || 'Failed to delete class');
            }
            
            return response.data;
        } catch (error: any) {
            console.error('Delete class error:', error);
            throw new Error(
                error.response?.data?.message || 
                error.message || 
                'Failed to delete class'
            );
        }
    }

    async deleteModule(moduleId: string) {
        try {
            const response = await axios.delete(`${API_URL}/content/deleteModule/${moduleId}`, {
                headers: {
                    'Authorization': `Bearer ${authService.getAccessToken()}`
                }
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Delete module error:', error.response?.data);
                throw error;
            }
            throw error;
        }
    }

    async saveVideoProgress(classId: string, progress: number) {
        try {
            const response = await axios.post(`${API_URL}/content/saveVideoProgress`, {
                classId,
                progress
            }, {
                headers: {
                    'Authorization': `Bearer ${authService.getAccessToken()}`
                }
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('Save video progress error:', error.response?.data);
                throw error;
            }
            throw error;
        }
    }

    private handleError(error: any) {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.message;
            
            switch (status) {
                case 404:
                    return {
                        success: false,
                        message: message || 'Resource not found',
                        notFound: true
                    };
                case 403:
                    return {
                        success: false,
                        message: message || 'Permission denied',
                        forbidden: true
                    };
                case 401:
                    return {
                        success: false,
                        message: message || 'Authentication required',
                        unauthorized: true
                    };
                default:
                    return {
                        success: false,
                        message: message || 'An error occurred'
                    };
            }
        }
        return {
            success: false,
            message: 'An unexpected error occurred'
        };
    }

    private getToken() {
        // Get the token from localStorage or your auth service
        return localStorage.getItem('token') || '';
    }

    // Add method for uploading study materials
    async uploadStudyMaterial(moduleId: string, formData: FormData) {
        try {
            await authService.validateSession();
            const freshToken = authService.getAccessToken();

            const response = await axios.post(
                `${API_URL}/content/uploadStudyMaterial`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${freshToken}`,
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );
            return response.data;
        } catch (error: any) {
            console.error('Upload study material error:', error.response?.data || error);
            throw error;
        }
    }

    async deleteStudyMaterial(materialId: string) {
        try {
            await authService.validateSession();
            const token = authService.getAccessToken();
            
            const response = await axios.delete(
                `${API_URL}/content/deleteStudyMaterial/${materialId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('Delete study material error:', error);
            throw error;
        }
    }
}

// Create a singleton instance
const contentService = new ContentService();

// Add static methods to maintain backward compatibility
Object.getOwnPropertyNames(ContentService.prototype).forEach(method => {
    if (method !== 'constructor') {
        (ContentService as any)[method] = (...args: any[]) => {
            return (contentService as any)[method](...args);
        };
    }
});

export default contentService;
