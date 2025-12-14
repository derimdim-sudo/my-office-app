import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  deleteDoc, 
  doc
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  User, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Coffee,
  Shirt,
  Bell,
  X
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Fix: Use a Stable App ID ---
// ใช้ ID แบบตายตัวและปลอดภัย (ไม่มีอักขระพิเศษ) เพื่อป้องกัน Error Permission
const appId = 'executive-sync-app-v2';

// --- Sound Effect URL ---
const PLAY_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

// --- Date Helper Function ---
const formatDateKey = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Updated Date Format with Weekday ---
const formatDate = (date) => {
  if (!date) return '';
  return date.toLocaleDateString('th-TH', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};

// --- Main Component ---
export default function AppointmentScheduler() {
  const [user, setUser] = useState(null);
  const [officeId] = useState('MY-OFFICE'); 
  const [username] = useState('Admin'); 
  
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState('calendar'); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [showSuccessAlert, setShowSuccessAlert] = useState(false); 
  const [newIncomingAlert, setNewIncomingAlert] = useState(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newAppt, setNewAppt] = useState({ 
    title: '', 
    time: '09:00', 
    type: 'work', 
    note: '', 
    dressCode: '' 
  });

  const isFirstLoad = useRef(true);
  const audioRef = useRef(new Audio(PLAY_SOUND_URL));

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // โหลดข้อมูลแม้จะไม่มี User (ในบางกรณี) หรือรอ User
    // แต่เพื่อความชัวร์ รอ User ก่อน
    if (!user) {
        // ถ้ายังไม่ login ให้แสดงว่างไปก่อน หรือ loading
        return; 
    }

    setLoading(true);
    
    // ใช้ appId ที่ปลอดภัย
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'appointments');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const officeData = allData.filter(item => item.officeId === officeId);
      
      setAppointments(officeData);
      setLoading(false);

      if (!isFirstLoad.current) {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          if (change.type === "added" && data.officeId === officeId) {
             triggerIncomingNotification(data);
          }
        });
      } else {
        isFirstLoad.current = false;
      }

    }, (error) => {
      console.error("Error fetching appointments:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, officeId]);

  const triggerIncomingNotification = (data) => {
    try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.log("Audio play blocked", e));
    } catch(e) {}

    setNewIncomingAlert(`${data.title} (${data.time})`);
    
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`📅 งานใหม่เข้า!`, {
        body: `${data.title} เวลา ${data.time}`,
      });
    }
    setTimeout(() => setNewIncomingAlert(null), 5000);
  };

  const addAppointment = async () => {
    if (!newAppt.title) return;
    
    try {
      const dateStr = formatDateKey(selectedDate);
      
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'appointments'), {
        officeId: officeId,
        date: dateStr,
        time: newAppt.time,
        title: newAppt.title,
        type: newAppt.type,
        note: newAppt.note,
        dressCode: newAppt.dressCode,
        createdBy: username,
        createdAt: new Date().toISOString()
      });
      
      setIsAdding(false);
      setNewAppt({ title: '', time: '09:00', type: 'work', note: '', dressCode: '' });

      setShowSuccessAlert(true);
      setTimeout(() => setShowSuccessAlert(false), 2000);

    } catch (err) {
      console.error("Error adding doc:", err);
      alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    }
  };

  const deleteAppointment = async (id) => {
    if(!confirm("ต้องการลบนัดหมายนี้ใช่หรือไม่?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'appointments', id));
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getAppointmentsForDate = (date) => {
    const dateStr = formatDateKey(date);
    return appointments
      .filter(a => a.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  };

  const getFreeDaysInMonth = () => {
    const days = getDaysInMonth(currentMonth);
    const freeDays = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dateStr = formatDateKey(d);
      if (!appointments.some(a => a.date === dateStr)) freeDays.push(d);
    }
    return freeDays;
  };

  // --- Components ---

  const SuccessPopup = () => (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none w-max">
      <div className="bg-slate-900/90 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce-in backdrop-blur-sm">
        <CheckCircle2 size={16} className="text-green-400" />
        <span className="font-bold text-sm">บันทึกสำเร็จ!</span>
      </div>
    </div>
  );

  const NewTaskAlert = ({ message, onClose }) => (
    <div className="fixed top-4 left-4 right-4 z-[70] animate-slide-down">
        <div className="bg-white border-l-4 border-red-500 rounded-lg shadow-xl p-4 flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-full text-red-600"><Bell size={20} /></div>
            <div className="flex-1">
                <h3 className="font-bold text-slate-800">มีงานเข้าใหม่!</h3>
                <p className="text-sm text-slate-600">{message}</p>
            </div>
            <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
    </div>
  );

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="text-xl font-bold text-slate-800">
            {currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 bg-white rounded-full border shadow-sm"><ChevronLeft size={20}/></button>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 bg-white rounded-full border shadow-sm"><ChevronRight size={20}/></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs text-slate-400 font-bold">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {blanks.map((_, i) => <div key={`b-${i}`} className="h-10 md:h-14"></div>)}
          {days.map(day => {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const dateStr = formatDateKey(date);
            
            const isToday = formatDateKey(new Date()) === dateStr;
            const isSelected = formatDateKey(selectedDate) === dateStr;
            const busy = appointments.some(a => a.date === dateStr);

            return (
              <button key={day} onClick={() => { setSelectedDate(date); setView('day'); }}
                className={`relative h-12 md:h-16 rounded-xl flex flex-col items-center justify-center border transition-all overflow-hidden
                  ${isSelected ? 'bg-slate-900 text-white border-slate-900' : 
                    busy ? 'bg-orange-100 border-orange-200 text-slate-900' : 'bg-white text-slate-700 hover:border-slate-300'}
                  ${isToday && !isSelected && !busy ? 'text-blue-600 font-bold border-blue-200' : ''}
                `}
              >
                <span className={`text-sm z-10 ${busy && !isSelected ? 'font-bold' : ''}`}>{day}</span>
                
                {busy && (
                  <div className={`absolute bottom-1 flex gap-0.5`}>
                     <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-orange-500'}`}></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-8 flex justify-center">
             <button onClick={() => setView('summary')} className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm border hover:bg-slate-50 transition-colors">
                <CheckCircle2 size={16} /> ดูวันว่างทั้งหมด
             </button>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayApps = getAppointmentsForDate(selectedDate);
    return (
      <div className="animate-fade-in pb-24">
        <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => setView('calendar')}>
          <div className="p-2 bg-white rounded-full border shadow-sm"><ChevronLeft size={20}/></div>
          <h2 className="text-lg font-bold text-slate-800">{formatDate(selectedDate)}</h2>
        </div>
        <div className="space-y-4">
          {dayApps.length === 0 ? (
            <div className="text-center py-12">
               <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400"><Coffee size={24}/></div>
               <p className="text-slate-400">วันนี้ว่าง ไม่มีนัดหมาย</p>
            </div>
          ) : (
            dayApps.map((app) => (
              <div key={app.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="text-lg font-bold text-slate-800">{app.time}</span>
                  <div className="h-full w-0.5 bg-slate-100 mt-2"></div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-slate-800 text-lg">{app.title}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${app.type === 'personal' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                        {app.type === 'personal' ? 'ส่วนตัว' : 'งาน'}
                      </span>
                    </div>
                    <button onClick={() => deleteAppointment(app.id)} className="text-slate-300 hover:text-red-400"><Trash2 size={18} /></button>
                  </div>
                  {app.dressCode && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-100">
                      <Shirt size={16} /> <span>แต่งกาย: {app.dressCode}</span>
                    </div>
                  )}
                  {app.note && <p className="text-slate-500 text-sm mt-2 bg-slate-50 p-2 rounded-lg">{app.note}</p>}
                </div>
              </div>
            ))
          )}
        </div>
        <button onClick={() => setIsAdding(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-800 z-20">
          <Plus size={24} />
        </button>
      </div>
    );
  };

  const renderFreeSummary = () => {
    const freeDays = getFreeDaysInMonth();
    return (
        <div className="animate-fade-in">
             <div className="flex items-center gap-2 mb-6 cursor-pointer" onClick={() => setView('calendar')}>
                <div className="p-2 bg-white rounded-full border shadow-sm"><ChevronLeft size={20}/></div>
                <h2 className="text-xl font-bold text-slate-800">สรุปวันว่าง</h2>
            </div>
            
            <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase">สรุปวันว่าง (พร้อมชื่อวัน)</h3>
                <p className="text-slate-800 text-sm leading-7 font-medium">
                   {freeDays.length > 0 ? freeDays.map(d => `${d.toLocaleDateString('th-TH', { weekday: 'long' })}ที่ ${d.getDate()}`).join(', ') : 'ไม่มีวันว่างเลย'}
                </p>
            </div>

            <div className="bg-green-50 p-6 rounded-2xl mb-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-green-200 text-green-700 rounded-full flex items-center justify-center font-bold text-xl">{freeDays.length}</div>
                <div><h3 className="font-bold text-green-900">วันว่างทั้งหมด</h3><p className="text-green-700 text-sm">{currentMonth.toLocaleDateString('th-TH', { month: 'long' })}</p></div>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
                {freeDays.map((date, idx) => (
                    <button key={idx} onClick={() => { setSelectedDate(date); setView('day'); }} className="bg-white p-2 rounded-xl border hover:border-green-400 text-center">
                        <div className="text-xs text-slate-400 mb-1">{date.toLocaleDateString('th-TH', { weekday: 'short' })}</div>
                        <div className="text-lg font-bold text-slate-800">{date.getDate()}</div>
                    </button>
                ))}
            </div>
        </div>
    )
  }

  const AddModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-slate-800 mb-4">ลงนัดหมายใหม่</h3>
        <div className="text-sm text-slate-500 mb-4">
            วันที่: <span className="text-slate-900 font-bold">{formatDate(selectedDate)}</span>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-500">หัวข้อ</label>
            <input type="text" className="w-full p-3 bg-slate-50 rounded-xl" placeholder="ประชุม..." value={newAppt.title} onChange={(e) => setNewAppt({...newAppt, title: e.target.value})} />
          </div>
          <div className="flex gap-4">
             <div className="flex-1">
                <label className="text-sm text-slate-500">เวลา</label>
                <input type="time" className="w-full p-3 bg-slate-50 rounded-xl" value={newAppt.time} onChange={(e) => setNewAppt({...newAppt, time: e.target.value})} />
             </div>
             <div className="flex-1">
                <label className="text-sm text-slate-500">ประเภท</label>
                <select className="w-full p-3 bg-slate-50 rounded-xl" value={newAppt.type} onChange={(e) => setNewAppt({...newAppt, type: e.target.value})}>
                    <option value="work">งาน</option>
                    <option value="personal">ส่วนตัว</option>
                </select>
             </div>
          </div>
          <div>
            <label className="text-sm text-slate-500 flex items-center gap-1"><Shirt size={14} /> การแต่งกาย</label>
            <input type="text" className="w-full p-3 bg-slate-50 rounded-xl" placeholder="เช่น ชุดข้าราชการกากี..." value={newAppt.dressCode} onChange={(e) => setNewAppt({...newAppt, dressCode: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-slate-500">รายละเอียด</label>
            <textarea className="w-full p-3 bg-slate-50 rounded-xl h-20 resize-none" value={newAppt.note} onChange={(e) => setNewAppt({...newAppt, note: e.target.value})} />
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setIsAdding(false)} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl">ยกเลิก</button>
            <button onClick={addAppointment} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg">บันทึก</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-10">
      {showSuccessAlert && <SuccessPopup />}
      {newIncomingAlert && <NewTaskAlert message={newIncomingAlert} onClose={() => setNewIncomingAlert(null)} />}
      
      <header className="bg-white px-6 py-4 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-lg">Executive Sync</h1>
          <div className="flex items-center gap-1 text-xs text-slate-400"><User size={12}/> {username}</div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        {loading ? (
            <div className="py-20 text-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-400 text-sm">กำลังโหลด...</p></div>
        ) : (
            <>
                {view === 'calendar' && renderCalendar()}
                {view === 'day' && renderDayView()}
                {view === 'summary' && renderFreeSummary()}
            </>
        )}
      </main>
      {isAdding && <AddModal />}
    </div>
  );
}
