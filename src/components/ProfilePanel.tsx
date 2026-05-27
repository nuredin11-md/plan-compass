import React, { useState } from 'react';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Upload, 
  Image as ImageIcon,
  Key,
  CheckCircle,
  LogOut,
  AlertCircle
} from 'lucide-react';

interface ProfilePanelProps {
  userProfile: UserProfile;
  isAuthenticated: boolean;
  onUpdateProfile: (profile: UserProfile) => void;
  onAuthenticate: (verified: boolean) => void;
}

export default function ProfilePanel({ 
  userProfile, 
  isAuthenticated, 
  onUpdateProfile, 
  onAuthenticate 
}: ProfilePanelProps) {
  
  // Profile field states (loaded from props)
  const [name, setName] = useState(userProfile.name);
  const [role, setRole] = useState(userProfile.role);
  const [hospital, setHospital] = useState(userProfile.hospital);
  const [cellNumber, setCellNumber] = useState(userProfile.cellNumber);
  const [email, setEmail] = useState(userProfile.email);
  
  // Login flow states
  const [loginEmail, setLoginEmail] = useState('nuredinmuhammed176@gmail.com');
  const [loginCell, setLoginCell] = useState('0926703678');
  const [passcode, setPasscode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Passcode setup/change states
  const [storedPasscode, setStoredPasscode] = useState(() => {
    return localStorage.getItem('hospital_kpi_passcode') || '1234'; // Default passcode
  });
  const [editingPasscode, setEditingPasscode] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passcodeError, setPasscodeError] = useState('');

  // Local storage for avatar base64
  const [avatarData, setAvatarData] = useState(() => {
    return localStorage.getItem('hospital_kpi_avatar') || '';
  });

  // Handle avatar upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatarData(base64String);
        localStorage.setItem('hospital_kpi_avatar', base64String);
        alert("Coordinator profile picture updated successfully!");
      };
      reader.readAsDataURL(file);
    }
  };

  // Try Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (loginEmail.trim() !== userProfile.email || loginCell.trim() !== userProfile.cellNumber) {
      setErrorMessage("Error: Email or Cell Number does not match registered Plan Coordinator.");
      return;
    }

    if (passcode !== storedPasscode) {
      setErrorMessage("Error: Invalid active coordinator security passcode.");
      return;
    }

    onAuthenticate(true);
    alert(`Welcome back, ${userProfile.name}! Opened secured KPI interface.`);
  };

  // Save profile edits
  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      name,
      role,
      hospital,
      cellNumber,
      email
    };
    onUpdateProfile(updated);
    alert("Plan Coordinator profile update saved successfully.");
  };

  // Change security passcode
  const handlePasscodeChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError('');

    if (oldPass !== storedPasscode) {
      setPasscodeError('Current passcode is incorrect!');
      return;
    }

    if (newPass.length < 4) {
      setPasscodeError('New passcode must be at least 4 digits long');
      return;
    }

    if (newPass !== confirmPass) {
      setPasscodeError('Confirm passcode does not match new passcode');
      return;
    }

    setStoredPasscode(newPass);
    localStorage.setItem('hospital_kpi_passcode', newPass);
    alert('Security passcode changed successfully.');
    setOldPass('');
    setNewPass('');
    setConfirmPass('');
    setEditingPasscode(false);
  };

  return (
    <div id="profile-panel" className="max-w-4xl mx-auto space-y-6">
      
      {!isAuthenticated ? (
        /* Secures Login Verification flow */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden max-w-md mx-auto my-8">
          <div className="bg-slate-950 p-6 text-center text-white space-y-2">
            <Lock className="w-10 h-10 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold font-display">Secured Coordinator Portal</h2>
            <p className="text-xs text-slate-400">Authenticate credentials to modify Chefa Robit records.</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-xs text-rose-600 font-semibold rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Registered Coordinator Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Coordinator Cell Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={loginCell}
                  onChange={(e) => setLoginCell(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Hint: Defaults are: nuredinmuhammed176@gmail.com / 0926703678</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Security Passcode PIN</label>
              <div className="relative">
                <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="Enter Passcode (default is 1234)"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 font-mono font-bold tracking-widest text-center"
                  maxLength={10}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer mt-2"
            >
              Verify & Unlock System
            </button>
          </form>
        </div>
      ) : (
        /* Authenticated Control Console */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Avatar & Quick Info Card (4 columns) */}
          <div className="md:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
            
            {/* Profile Avatar Frame */}
            <div className="relative group">
              <div className="w-28 h-28 rounded-full border-4 border-slate-50 overflow-hidden shadow-inner bg-slate-100 flex items-center justify-center">
                {avatarData ? (
                  <img src={avatarData} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-slate-400" />
                )}
              </div>
              
              {/* Photo Input trigger */}
              <label 
                htmlFor="avatar-file-input"
                className="absolute bottom-0 right-0 p-2 bg-slate-950 hover:bg-slate-900 text-white rounded-full shadow-md cursor-pointer transition-colors"
                title="Change Photo"
              >
                <Upload className="w-3.5 h-3.5" />
              </label>
              <input 
                id="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div>
              <h3 className="text-base font-bold font-display text-slate-800">{userProfile.name}</h3>
              <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mt-1">{userProfile.role}</p>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold inline-block mt-2">
                Active Session verified
              </span>
            </div>

            <div className="w-full pt-4 border-t border-slate-100 space-y-3 text-xs text-left">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{userProfile.hospital}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{userProfile.cellNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{userProfile.email}</span>
              </div>
            </div>

            <button
              onClick={() => onAuthenticate(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout Safe Session
            </button>
          </div>

          {/* Right Column: Editable Metadata & Security config (8 columns) */}
          <div className="md:col-span-8 space-y-6">
            
            {/* Editor form card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold font-display text-base text-slate-800">Edit Coordinator Profile Details</h3>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Coordinator Name</label>
                    <input 
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Operational Role</label>
                    <input 
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Assigned Health Institution</label>
                  <input 
                    type="text"
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Secure Contact Number</label>
                    <input 
                      type="text"
                      value={cellNumber}
                      onChange={(e) => setCellNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Coordinator Official Email</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Save Profile Changes
                  </button>
                </div>
              </form>
            </div>

            {/* Passcode Security section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-slate-400" />
                  <h3 className="font-bold font-display text-base text-slate-800">Passcode Access Control</h3>
                </div>
                {!editingPasscode && (
                  <button
                    onClick={() => setEditingPasscode(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Change Passcode
                  </button>
                )}
              </div>

              {editingPasscode ? (
                <form onSubmit={handlePasscodeChange} className="space-y-4">
                  {passcodeError && (
                    <div className="text-xs text-rose-600 font-semibold p-2 bg-rose-50 border border-rose-100 rounded-lg">
                      {passcodeError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Old Passcode</label>
                      <input 
                        type="password"
                        placeholder="Current"
                        value={oldPass}
                        onChange={(e) => setOldPass(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center font-bold text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">New Passcode</label>
                      <input 
                        type="password"
                        placeholder="New (Min 4 chars)"
                        value={newPass}
                        onChange={(e) => setNewPass(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center font-bold text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Confirm New</label>
                      <input 
                        type="password"
                        placeholder="Confirm"
                        value={confirmPass}
                        onChange={(e) => setConfirmPass(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center font-bold text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPasscode(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                    >
                      Save Passcode PIN
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-slate-400">
                  Secured passcode PIN is currently active. The passcode prevents any unauthorized device from wiping or resetting November records for Chefa Robit Hospital. (Current active passcode is: <span className="font-bold text-slate-700 font-mono">****</span>).
                </p>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
