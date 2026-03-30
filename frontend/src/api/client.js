import axios from 'axios'
const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
    localStorage.removeItem('token'); globalThis.location.href = '/login'
  }
  return Promise.reject(err)
})
export default api
export const employeeApi = {
  list: p => api.get('/employees/', { params: p }),
  create: fd => api.post('/employees/', fd),
  update: (id, fd) => api.put(`/employees/${id}`, fd),
  remove: id => api.delete(`/employees/${id}`),
  departments: () => api.get('/employees/departments'),
}
export const recognitionApi = { identify: f => api.post('/recognition/identify', { frame: f }) }
export const attendanceApi = {
  punch: b => api.post('/attendance/punch', b),
  today: () => api.get('/attendance/today'),
  logs: p => api.get('/attendance/logs', { params: p }),
  exportCsv: p => api.get('/export/csv', { params: p, responseType: 'blob' }),
}
export const employeePanelApi = {
  me: () => api.get('/employee/me'),
  today: () => api.get('/employee/today'),
  attendance: p => api.get('/employee/attendance', { params: p }),
  punch: fd => api.post('/employee/punch', fd),
  createAccount: (empId, body) => api.post(`/employees/${empId}/create-account`, body),
}
export const settingsApi = {
  get:           ()     => api.get('/settings'),
  update:        body   => api.put('/settings', body),
  holidays:      ()     => api.get('/settings/holidays'),
  addHoliday:    body   => api.post('/settings/holidays', body),
  deleteHoliday: id     => api.delete(`/settings/holidays/${id}`),
}
