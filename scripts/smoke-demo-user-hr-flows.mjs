import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function optionalEnv(name, fallback = null) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    return fallback;
  }
  return String(value).trim();
}

function buildClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function getActiveCompany(authClient, userId) {
  const [prefsRes, companiesRes] = await Promise.all([
    authClient
      .from('user_company_preferences')
      .select('active_company_id')
      .eq('user_id', userId)
      .maybeSingle(),
    authClient
      .from('company')
      .select('id, company_name, country, currency, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  if (prefsRes.error) throw prefsRes.error;
  if (companiesRes.error) throw companiesRes.error;

  const companies = companiesRes.data || [];
  if (!companies.length) throw new Error(`No company found for user ${userId}`);
  const activeCompanyId = prefsRes.data?.active_company_id || null;
  return (
    companies.find((company) => company.id === activeCompanyId) ||
    companies.find((company) => /portfolio/i.test(String(company.company_name || ''))) ||
    companies[0]
  );
}

function opResult(ok, details = null, error = null) {
  return { ok, details, error };
}

function errorShape(error) {
  if (!error) return null;
  return {
    code: error.code || null,
    message: error.message || String(error),
  };
}

async function runHrFlowForAccount({ supabaseUrl, anonKey, account, runId }) {
  const summary = {
    key: account.key,
    email: account.email,
    passed: false,
    company: null,
    reads: {},
    operations: {
      team_member_crud: opResult(false),
      employee_crud: opResult(false),
      leave_request_crud: opResult(false),
      training_catalog_crud: opResult(false),
      training_enrollment_crud: opResult(false),
      recruitment_crud: opResult(false),
      interview_crud: opResult(false),
      onboarding_crud: opResult(false),
      performance_review_crud: opResult(false),
      risk_assessment_crud: opResult(false),
    },
    failures: [],
  };

  const cleanup = {
    teamMemberId: null,
    employeeId: null,
    leaveRequestId: null,
    trainingId: null,
    enrollmentId: null,
    positionId: null,
    candidateId: null,
    applicationId: null,
    interviewId: null,
    onboardingId: null,
    performanceReviewId: null,
    riskId: null,
  };

  const authClient = buildClient(supabaseUrl, anonKey);

  try {
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (authError) throw authError;
    const userId = authData?.user?.id || null;
    if (!userId) throw new Error('Sign-in succeeded but user id is missing.');

    const activeCompany = await getActiveCompany(authClient, userId);
    summary.company = {
      id: activeCompany.id,
      name: activeCompany.company_name,
      country: activeCompany.country,
      currency: activeCompany.currency,
    };

    const [employeesRes, departmentsRes, leaveTypesRes, trainingsRes, teamRes, positionsRes, onboardingRes, reviewsRes, risksRes, candidatesRes] = await Promise.all([
      authClient.from('hr_employees').select('id, company_id, first_name, last_name, status').eq('company_id', activeCompany.id).limit(100),
      authClient.from('hr_departments').select('id, company_id, name').eq('company_id', activeCompany.id).limit(100),
      authClient.from('hr_leave_types').select('id, company_id, name').eq('company_id', activeCompany.id).limit(100),
      authClient.from('hr_training_catalog').select('id, company_id, title').eq('company_id', activeCompany.id).limit(100),
      authClient.from('team_members').select('id, user_id, company_id, name').eq('company_id', activeCompany.id).limit(100),
      authClient.from('hr_job_positions').select('id').eq('company_id', activeCompany.id).limit(100),
      authClient.from('hr_onboarding_plans').select('id').eq('company_id', activeCompany.id).limit(100),
      authClient.from('hr_performance_reviews').select('id').eq('company_id', activeCompany.id).limit(100),
      authClient.from('hr_risk_assessments').select('id').eq('company_id', activeCompany.id).limit(100),
      authClient.from('hr_candidates').select('id').eq('company_id', activeCompany.id).limit(100),
    ]);

    if (employeesRes.error) throw employeesRes.error;
    if (departmentsRes.error) throw departmentsRes.error;
    if (leaveTypesRes.error) throw leaveTypesRes.error;
    if (trainingsRes.error) throw trainingsRes.error;
    if (teamRes.error) throw teamRes.error;
    if (positionsRes.error) throw positionsRes.error;
    if (onboardingRes.error) throw onboardingRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (risksRes.error) throw risksRes.error;
    if (candidatesRes.error) throw candidatesRes.error;

    const employees = employeesRes.data || [];
    const departments = departmentsRes.data || [];
    const leaveTypes = leaveTypesRes.data || [];
    const trainings = trainingsRes.data || [];
    const teamMembers = teamRes.data || [];
    const positions = positionsRes.data || [];
    const onboardingPlans = onboardingRes.data || [];
    const performanceReviews = reviewsRes.data || [];
    const riskAssessments = risksRes.data || [];
    const candidates = candidatesRes.data || [];

    summary.reads = {
      hr_employees: employees.length,
      hr_departments: departments.length,
      hr_leave_types: leaveTypes.length,
      hr_training_catalog: trainings.length,
      team_members: teamMembers.length,
      hr_job_positions: positions.length,
      hr_candidates: candidates.length,
      hr_onboarding_plans: onboardingPlans.length,
      hr_performance_reviews: performanceReviews.length,
      hr_risk_assessments: riskAssessments.length,
    };

    // 1) team_members CRUD (matches useTeamSettings)
    try {
      const { data: createdMember, error: createMemberError } = await authClient
        .from('team_members')
        .insert([{
          user_id: userId,
          company_id: activeCompany.id,
          name: `Smoke Team ${account.key} ${runId}`,
          email: `smoke.team.${account.key.toLowerCase()}.${runId}@cashpilot.test`,
          role: 'member',
          joined_at: isoDate(0),
        }])
        .select('id, company_id, role')
        .single();
      if (createMemberError) throw createMemberError;
      cleanup.teamMemberId = createdMember.id;

      const { data: updatedMember, error: updateMemberError } = await authClient
        .from('team_members')
        .update({ role: 'manager' })
        .eq('id', createdMember.id)
        .eq('company_id', activeCompany.id)
        .select('id, role')
        .single();
      if (updateMemberError) throw updateMemberError;

      const { error: deleteMemberError } = await authClient
        .from('team_members')
        .delete()
        .eq('id', createdMember.id)
        .eq('company_id', activeCompany.id);
      if (deleteMemberError) throw deleteMemberError;
      cleanup.teamMemberId = null;

      summary.operations.team_member_crud = opResult(true, { updatedRole: updatedMember.role });
    } catch (error) {
      summary.operations.team_member_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`team_member_crud: ${error?.message || String(error)}`);
    }

    // 2) hr_employees CRUD (matches useEmployees)
    try {
      const departmentId = departments[0]?.id || null;
      const { data: createdEmployee, error: createEmployeeError } = await authClient
        .from('hr_employees')
        .insert([{
          company_id: activeCompany.id,
          first_name: 'Smoke',
          last_name: `Employee-${account.key}`,
          full_name: `Smoke Employee ${account.key}`,
          status: 'active',
          department_id: departmentId,
          job_title: 'Test Analyst',
          hire_date: isoDate(-5),
        }])
        .select('id, company_id, full_name, job_title')
        .single();
      if (createEmployeeError) throw createEmployeeError;
      cleanup.employeeId = createdEmployee.id;

      const { data: updatedEmployee, error: updateEmployeeError } = await authClient
        .from('hr_employees')
        .update({ job_title: 'Senior Test Analyst' })
        .eq('id', createdEmployee.id)
        .eq('company_id', activeCompany.id)
        .select('id, job_title')
        .single();
      if (updateEmployeeError) throw updateEmployeeError;

      const { error: deleteEmployeeError } = await authClient
        .from('hr_employees')
        .delete()
        .eq('id', createdEmployee.id)
        .eq('company_id', activeCompany.id);
      if (deleteEmployeeError) throw deleteEmployeeError;
      cleanup.employeeId = null;

      summary.operations.employee_crud = opResult(true, { updatedJobTitle: updatedEmployee.job_title });
    } catch (error) {
      summary.operations.employee_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`employee_crud: ${error?.message || String(error)}`);
    }

    // 3) hr_leave_requests CRUD (matches useAbsences)
    try {
      const employeeId = employees[0]?.id || null;
      const leaveTypeId = leaveTypes[0]?.id || null;
      if (!employeeId || !leaveTypeId) {
        throw new Error('Missing employee or leave type for leave request test.');
      }

      const { data: createdLeave, error: createLeaveError } = await authClient
        .from('hr_leave_requests')
        .insert([{
          company_id: activeCompany.id,
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          start_date: isoDate(7),
          end_date: isoDate(8),
          total_days: 2,
          status: 'submitted',
          reason: `Smoke leave ${runId}`,
        }])
        .select('id, status')
        .single();
      if (createLeaveError) throw createLeaveError;
      cleanup.leaveRequestId = createdLeave.id;

      const { data: updatedLeave, error: updateLeaveError } = await authClient
        .from('hr_leave_requests')
        .update({ status: 'approved' })
        .eq('id', createdLeave.id)
        .eq('company_id', activeCompany.id)
        .select('id, status')
        .single();
      if (updateLeaveError) throw updateLeaveError;

      const { error: deleteLeaveError } = await authClient
        .from('hr_leave_requests')
        .delete()
        .eq('id', createdLeave.id)
        .eq('company_id', activeCompany.id);
      if (deleteLeaveError) throw deleteLeaveError;
      cleanup.leaveRequestId = null;

      summary.operations.leave_request_crud = opResult(true, { updatedStatus: updatedLeave.status });
    } catch (error) {
      summary.operations.leave_request_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`leave_request_crud: ${error?.message || String(error)}`);
    }

    // 4) hr_training_catalog CRUD (matches useTraining)
    try {
      const { data: createdTraining, error: createTrainingError } = await authClient
        .from('hr_training_catalog')
        .insert([{
          company_id: activeCompany.id,
          title: `Smoke Training ${account.key} ${runId}`,
          description: 'Smoke test training',
          provider: 'CashPilot QA',
          duration_hours: 4,
          cost_per_person: 150,
          currency: activeCompany.currency || 'EUR',
          skills_covered: ['Testing'],
          is_mandatory: false,
          cpf_eligible: false,
          opco_eligible: false,
          is_active: true,
        }])
        .select('id, title, is_active')
        .single();
      if (createTrainingError) throw createTrainingError;
      cleanup.trainingId = createdTraining.id;

      const { data: updatedTraining, error: updateTrainingError } = await authClient
        .from('hr_training_catalog')
        .update({ is_active: false })
        .eq('id', createdTraining.id)
        .eq('company_id', activeCompany.id)
        .select('id, is_active')
        .single();
      if (updateTrainingError) throw updateTrainingError;

      summary.operations.training_catalog_crud = opResult(true, { isActiveAfterUpdate: updatedTraining.is_active });
    } catch (error) {
      summary.operations.training_catalog_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`training_catalog_crud: ${error?.message || String(error)}`);
    }

    // 5) hr_training_enrollments CRUD (depends on training + employee)
    try {
      const employeeId = employees[0]?.id || null;
      const trainingId = cleanup.trainingId || trainings[0]?.id || null;
      if (!employeeId || !trainingId) {
        throw new Error('Missing training or employee for enrollment test.');
      }

      const { data: createdEnrollment, error: createEnrollmentError } = await authClient
        .from('hr_training_enrollments')
        .insert([{
          company_id: activeCompany.id,
          training_id: trainingId,
          employee_id: employeeId,
          status: 'registered',
          planned_start_date: isoDate(14),
          planned_end_date: isoDate(16),
        }])
        .select('id, status')
        .single();
      if (createEnrollmentError) throw createEnrollmentError;
      cleanup.enrollmentId = createdEnrollment.id;

      const { data: updatedEnrollment, error: updateEnrollmentError } = await authClient
        .from('hr_training_enrollments')
        .update({ status: 'completed', actual_end_date: isoDate(16) })
        .eq('id', createdEnrollment.id)
        .eq('company_id', activeCompany.id)
        .select('id, status')
        .single();
      if (updateEnrollmentError) throw updateEnrollmentError;

      const { error: deleteEnrollmentError } = await authClient
        .from('hr_training_enrollments')
        .delete()
        .eq('id', createdEnrollment.id)
        .eq('company_id', activeCompany.id);
      if (deleteEnrollmentError) throw deleteEnrollmentError;
      cleanup.enrollmentId = null;

      summary.operations.training_enrollment_crud = opResult(true, { updatedStatus: updatedEnrollment.status });
    } catch (error) {
      summary.operations.training_enrollment_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`training_enrollment_crud: ${error?.message || String(error)}`);
    }

    // 6) recruitment core CRUD (positions/candidates/applications)
    try {
      const assignedEmployeeId = employees[0]?.id || null;
      if (!assignedEmployeeId) {
        throw new Error('Missing active employee for recruitment test.');
      }

      const { data: createdPosition, error: createPositionError } = await authClient
        .from('hr_job_positions')
        .insert([{
          company_id: activeCompany.id,
          title: `Smoke Position ${account.key} ${runId}`,
          status: 'open',
          employment_type: 'cdi',
          remote_policy: 'hybrid',
        }])
        .select('id, title, status')
        .single();
      if (createPositionError) throw createPositionError;
      cleanup.positionId = createdPosition.id;

      const { data: createdCandidate, error: createCandidateError } = await authClient
        .from('hr_candidates')
        .insert([{
          company_id: activeCompany.id,
          first_name: 'Smoke',
          last_name: `Candidate-${account.key}`,
          email: `smoke.candidate.${account.key.toLowerCase()}.${runId}@cashpilot.test`,
          source: 'direct',
          gdpr_consent: true,
          gdpr_consent_date: new Date().toISOString(),
        }])
        .select('id, first_name, last_name')
        .single();
      if (createCandidateError) throw createCandidateError;
      cleanup.candidateId = createdCandidate.id;

      const { data: createdApplication, error: createApplicationError } = await authClient
        .from('hr_applications')
        .insert([{
          company_id: activeCompany.id,
          position_id: createdPosition.id,
          candidate_id: createdCandidate.id,
          status: 'new',
          assigned_to: assignedEmployeeId,
        }])
        .select('id, status')
        .single();
      if (createApplicationError) throw createApplicationError;
      cleanup.applicationId = createdApplication.id;

      const { data: updatedApplication, error: updateApplicationError } = await authClient
        .from('hr_applications')
        .update({ status: 'screening' })
        .eq('id', createdApplication.id)
        .eq('company_id', activeCompany.id)
        .select('id, status')
        .single();
      if (updateApplicationError) throw updateApplicationError;

      summary.operations.recruitment_crud = opResult(true, { updatedStatus: updatedApplication.status });
    } catch (error) {
      summary.operations.recruitment_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`recruitment_crud: ${error?.message || String(error)}`);
    }

    // 7) interview sessions CRUD
    try {
      const applicationId = cleanup.applicationId;
      const interviewerId = employees[0]?.id || null;
      if (!applicationId || !interviewerId) {
        throw new Error('Missing application or interviewer for interview test.');
      }

      const { data: createdInterview, error: createInterviewError } = await authClient
        .from('hr_interview_sessions')
        .insert([{
          company_id: activeCompany.id,
          application_id: applicationId,
          interviewer_id: interviewerId,
          scheduled_at: new Date(Date.now() + (3 * 86400000)).toISOString(),
          duration_minutes: 60,
          format: 'video',
          status: 'scheduled',
        }])
        .select('id, status')
        .single();
      if (createInterviewError) throw createInterviewError;
      cleanup.interviewId = createdInterview.id;

      const { data: updatedInterview, error: updateInterviewError } = await authClient
        .from('hr_interview_sessions')
        .update({
          status: 'completed',
          score: 4,
          recommendation: 'yes',
          feedback: `Smoke interview ${runId}`,
        })
        .eq('id', createdInterview.id)
        .eq('company_id', activeCompany.id)
        .select('id, status, recommendation')
        .single();
      if (updateInterviewError) throw updateInterviewError;

      const { error: deleteInterviewError } = await authClient
        .from('hr_interview_sessions')
        .delete()
        .eq('id', createdInterview.id)
        .eq('company_id', activeCompany.id);
      if (deleteInterviewError) throw deleteInterviewError;
      cleanup.interviewId = null;

      summary.operations.interview_crud = opResult(true, {
        updatedStatus: updatedInterview.status,
        recommendation: updatedInterview.recommendation,
      });
    } catch (error) {
      summary.operations.interview_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`interview_crud: ${error?.message || String(error)}`);
    }

    // 8) onboarding plans CRUD
    try {
      const employeeId = employees[0]?.id || null;
      const buddyId = employees[1]?.id || employeeId;
      if (!employeeId) {
        throw new Error('Missing employee for onboarding test.');
      }

      const { data: createdOnboarding, error: createOnboardingError } = await authClient
        .from('hr_onboarding_plans')
        .insert([{
          company_id: activeCompany.id,
          employee_id: employeeId,
          status: 'active',
          start_date: isoDate(1),
          end_date: isoDate(30),
          buddy_id: buddyId,
          manager_id: employees[0]?.id || null,
          checklist: [{ task: 'Laptop ready', completed: true }],
        }])
        .select('id, status, completion_pct')
        .single();
      if (createOnboardingError) throw createOnboardingError;
      cleanup.onboardingId = createdOnboarding.id;

      const { data: updatedOnboarding, error: updateOnboardingError } = await authClient
        .from('hr_onboarding_plans')
        .update({ completion_pct: 50 })
        .eq('id', createdOnboarding.id)
        .eq('company_id', activeCompany.id)
        .select('id, completion_pct')
        .single();
      if (updateOnboardingError) throw updateOnboardingError;

      const { error: deleteOnboardingError } = await authClient
        .from('hr_onboarding_plans')
        .delete()
        .eq('id', createdOnboarding.id)
        .eq('company_id', activeCompany.id);
      if (deleteOnboardingError) throw deleteOnboardingError;
      cleanup.onboardingId = null;

      summary.operations.onboarding_crud = opResult(true, { completionPct: Number(updatedOnboarding.completion_pct || 0) });
    } catch (error) {
      summary.operations.onboarding_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`onboarding_crud: ${error?.message || String(error)}`);
    }

    // 9) performance reviews CRUD
    try {
      const employeeId = employees[0]?.id || null;
      const reviewerId = employees[1]?.id || employeeId;
      if (!employeeId) {
        throw new Error('Missing employee for performance review test.');
      }

      const { data: createdReview, error: createReviewError } = await authClient
        .from('hr_performance_reviews')
        .insert([{
          company_id: activeCompany.id,
          employee_id: employeeId,
          reviewer_id: reviewerId,
          period_year: new Date().getUTCFullYear(),
          review_type: 'annual',
          status: 'employee_draft',
        }])
        .select('id, status')
        .single();
      if (createReviewError) throw createReviewError;
      cleanup.performanceReviewId = createdReview.id;

      const { data: updatedReview, error: updateReviewError } = await authClient
        .from('hr_performance_reviews')
        .update({ status: 'manager_review' })
        .eq('id', createdReview.id)
        .eq('company_id', activeCompany.id)
        .select('id, status')
        .single();
      if (updateReviewError) throw updateReviewError;

      const { error: deleteReviewError } = await authClient
        .from('hr_performance_reviews')
        .delete()
        .eq('id', createdReview.id)
        .eq('company_id', activeCompany.id);
      if (deleteReviewError) throw deleteReviewError;
      cleanup.performanceReviewId = null;

      summary.operations.performance_review_crud = opResult(true, { updatedStatus: updatedReview.status });
    } catch (error) {
      summary.operations.performance_review_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`performance_review_crud: ${error?.message || String(error)}`);
    }

    // 10) risk assessments CRUD
    try {
      const departmentId = departments[0]?.id || null;
      const responsibleId = employees[0]?.id || null;

      const { data: createdRisk, error: createRiskError } = await authClient
        .from('hr_risk_assessments')
        .insert([{
          company_id: activeCompany.id,
          assessment_type: 'duerp',
          department_id: departmentId,
          risk_category: 'Operational',
          risk_description: `Smoke risk ${account.key} ${runId}`,
          probability: 2,
          severity: 2,
          responsible_id: responsibleId,
          status: 'identified',
        }])
        .select('id, status')
        .single();
      if (createRiskError) throw createRiskError;
      cleanup.riskId = createdRisk.id;

      const { data: updatedRisk, error: updateRiskError } = await authClient
        .from('hr_risk_assessments')
        .update({ status: 'in_progress' })
        .eq('id', createdRisk.id)
        .eq('company_id', activeCompany.id)
        .select('id, status')
        .single();
      if (updateRiskError) throw updateRiskError;

      const { error: deleteRiskError } = await authClient
        .from('hr_risk_assessments')
        .delete()
        .eq('id', createdRisk.id)
        .eq('company_id', activeCompany.id);
      if (deleteRiskError) throw deleteRiskError;
      cleanup.riskId = null;

      summary.operations.risk_assessment_crud = opResult(true, { updatedStatus: updatedRisk.status });
    } catch (error) {
      summary.operations.risk_assessment_crud = opResult(false, null, errorShape(error));
      summary.failures.push(`risk_assessment_crud: ${error?.message || String(error)}`);
    }

    // Cleanup recruitment records
    if (cleanup.applicationId) {
      const { error: deleteApplicationError } = await authClient
        .from('hr_applications')
        .delete()
        .eq('id', cleanup.applicationId)
        .eq('company_id', activeCompany.id);
      if (deleteApplicationError) {
        summary.failures.push(`recruitment_delete_application: ${deleteApplicationError.message || String(deleteApplicationError)}`);
      } else {
        cleanup.applicationId = null;
      }
    }
    if (cleanup.candidateId) {
      const { error: deleteCandidateError } = await authClient
        .from('hr_candidates')
        .delete()
        .eq('id', cleanup.candidateId)
        .eq('company_id', activeCompany.id);
      if (deleteCandidateError) {
        summary.failures.push(`recruitment_delete_candidate: ${deleteCandidateError.message || String(deleteCandidateError)}`);
      } else {
        cleanup.candidateId = null;
      }
    }
    if (cleanup.positionId) {
      const { error: deletePositionError } = await authClient
        .from('hr_job_positions')
        .delete()
        .eq('id', cleanup.positionId)
        .eq('company_id', activeCompany.id);
      if (deletePositionError) {
        summary.failures.push(`recruitment_delete_position: ${deletePositionError.message || String(deletePositionError)}`);
      } else {
        cleanup.positionId = null;
      }
    }

    // Cleanup training after enrollment deletion
    if (cleanup.trainingId) {
      const { error: deleteTrainingError } = await authClient
        .from('hr_training_catalog')
        .delete()
        .eq('id', cleanup.trainingId)
        .eq('company_id', activeCompany.id);
      if (deleteTrainingError) {
        summary.failures.push(`training_catalog_delete: ${deleteTrainingError.message || String(deleteTrainingError)}`);
      } else {
        cleanup.trainingId = null;
      }
    }

    summary.passed = summary.failures.length === 0;
  } catch (error) {
    summary.passed = false;
    summary.failures.push(error?.message || String(error));
  } finally {
    // Best-effort cleanup in reverse order
    try {
      if (cleanup.interviewId) {
        await authClient.from('hr_interview_sessions').delete().eq('id', cleanup.interviewId);
      }
      if (cleanup.applicationId) {
        await authClient.from('hr_applications').delete().eq('id', cleanup.applicationId);
      }
      if (cleanup.candidateId) {
        await authClient.from('hr_candidates').delete().eq('id', cleanup.candidateId);
      }
      if (cleanup.positionId) {
        await authClient.from('hr_job_positions').delete().eq('id', cleanup.positionId);
      }
      if (cleanup.onboardingId) {
        await authClient.from('hr_onboarding_plans').delete().eq('id', cleanup.onboardingId);
      }
      if (cleanup.performanceReviewId) {
        await authClient.from('hr_performance_reviews').delete().eq('id', cleanup.performanceReviewId);
      }
      if (cleanup.riskId) {
        await authClient.from('hr_risk_assessments').delete().eq('id', cleanup.riskId);
      }
      if (cleanup.enrollmentId) {
        await authClient.from('hr_training_enrollments').delete().eq('id', cleanup.enrollmentId);
      }
      if (cleanup.leaveRequestId) {
        await authClient.from('hr_leave_requests').delete().eq('id', cleanup.leaveRequestId);
      }
      if (cleanup.trainingId) {
        await authClient.from('hr_training_catalog').delete().eq('id', cleanup.trainingId);
      }
      if (cleanup.teamMemberId) {
        await authClient.from('team_members').delete().eq('id', cleanup.teamMemberId);
      }
      if (cleanup.employeeId) {
        await authClient.from('hr_employees').delete().eq('id', cleanup.employeeId);
      }
    } catch (cleanupError) {
      summary.failures.push(`cleanup_failed: ${cleanupError?.message || String(cleanupError)}`);
      summary.passed = false;
    }

    await authClient.auth.signOut();
  }

  return summary;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');

  const accounts = [
    {
      key: 'FR',
      email: optionalEnv('PILOTAGE_FR_EMAIL', 'pilotage.fr.demo@cashpilot.cloud'),
      password: requireEnv('PILOTAGE_FR_PASSWORD'),
    },
    {
      key: 'BE',
      email: optionalEnv('PILOTAGE_BE_EMAIL', 'pilotage.be.demo@cashpilot.cloud'),
      password: requireEnv('PILOTAGE_BE_PASSWORD'),
    },
    {
      key: 'OHADA',
      email: optionalEnv('PILOTAGE_OHADA_EMAIL', 'pilotage.ohada.demo@cashpilot.cloud'),
      password: requireEnv('PILOTAGE_OHADA_PASSWORD'),
    },
  ];

  const runId = `${Date.now().toString(36)}${randomUUID().slice(0, 8).replace(/-/g, '')}`;
  const results = [];
  for (const account of accounts) {
    const accountResult = await runHrFlowForAccount({ supabaseUrl, anonKey, account, runId });
    results.push(accountResult);
  }

  const failed = results.filter((result) => !result.passed);
  const summary = {
    generatedAt: new Date().toISOString(),
    runId,
    totals: {
      totalAccounts: results.length,
      passedAccounts: results.length - failed.length,
      failedAccounts: failed.length,
    },
    results,
    failedKeys: failed.map((result) => result.key),
  };

  const outputDir = path.resolve('artifacts', 'demo-user-hr-flows');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[smoke-demo-user-hr-flows] fatal:', error?.message || error);
  process.exitCode = 1;
});
