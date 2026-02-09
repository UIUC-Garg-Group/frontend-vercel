// UR2Stepper.jsx - Responsive Stepper (Vertical on mobile, Horizontal on tablet+)
import React from "react";
import PropTypes from "prop-types";
import { Stepper, Step, StepLabel, Box, StepConnector } from "@mui/material";
import { styled } from "@mui/material/styles";

const STATUS_COLORS = {
  done: "#10B981",   // green-500
  active: "#3B82F6", // blue-500
  waiting: "#9CA3AF", // gray-400
  failed: "#EF4444",  // red-500
};

// Custom connector for horizontal layout
const HorizontalConnector = styled(StepConnector)({
  "&.MuiStepConnector-alternativeLabel": {
    top: 20,
    left: "calc(-50% + 25px)",
    right: "calc(50% + 25px)",
  },
  "& .MuiStepConnector-line": {
    borderTopWidth: 3,
    borderColor: "#d1d5db",
  },
  "&.Mui-active .MuiStepConnector-line": {
    borderColor: STATUS_COLORS.active,
  },
  "&.Mui-completed .MuiStepConnector-line": {
    borderColor: STATUS_COLORS.done,
  },
});

// Custom connector for vertical layout
const VerticalConnector = styled(StepConnector)({
  "& .MuiStepConnector-line": {
    borderLeftWidth: 3,
    borderColor: "#d1d5db",
    minHeight: "48px",
  },
  "&.Mui-active .MuiStepConnector-line": {
    borderColor: STATUS_COLORS.active,
  },
  "&.Mui-completed .MuiStepConnector-line": {
    borderColor: STATUS_COLORS.done,
  },
});

// Bubble renderer
function StatusStepIcon({ icon, status }) {
  const bg = STATUS_COLORS[status] || STATUS_COLORS.waiting;
  return (
    <Box
      className="flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-base"
      sx={{ backgroundColor: bg }}
    >
      {icon}
    </Box>
  );
}

StatusStepIcon.propTypes = {
  icon: PropTypes.node,
  status: PropTypes.oneOf(["waiting", "active", "done", "failed"]),
};

// Compute per-step status from currentStage / interruption
function computeStatus(index, currentStage, total, isInterrupted) {
  if (total <= 0) return "waiting";

  if (currentStage >= total && !isInterrupted) {
    return "done";
  }

  if (isInterrupted) {
    const lastCompleted = Math.max(-1, Math.min(currentStage - 1, total - 1));
    if (index <= lastCompleted) return "done";
    return "failed";
  }

  if (index < currentStage) return "done";
  if (index === currentStage && currentStage < total) return "active";
  return "waiting";
}

export default function UR2Stepper({
  stages,
  currentStage,
  isInterrupted = false,
}) {
  const items = Array.isArray(stages) && stages.length > 0 ? stages : [];
  const total = items.length;
  const activeIndex = Math.min(Math.max(0, currentStage), Math.max(0, total - 1));

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Mobile: Vertical Stepper */}
      <div className="block md:hidden">
        <Stepper
          activeStep={activeIndex}
          orientation="vertical"
          connector={<VerticalConnector />}
        >
          {items.map((title, idx) => {
            const status = computeStatus(idx, currentStage, total, isInterrupted);
            const StepIconWithStatus = (props) => (
              <StatusStepIcon {...props} status={status} />
            );

            return (
              <Step
                key={`${idx}-${title}`}
                completed={status === "done"}
                active={status === "active"}
                error={status === "failed"}
              >
                <StepLabel slots={{ stepIcon: StepIconWithStatus }}>
                  <div className="flex flex-col ml-2">
                    <span
                      className="mb-1 text-xs capitalize"
                      style={{
                        color:
                          status === "done"
                            ? STATUS_COLORS.done
                            : status === "active"
                            ? STATUS_COLORS.active
                            : status === "failed"
                            ? STATUS_COLORS.failed
                            : "#6b7280",
                      }}
                    >
                      {status}
                    </span>
                    <span className="text-sm font-medium text-gray-900 leading-tight">
                      {title === "Image Capture" ? "Aluminum Image Capture" : title}
                    </span>
                  </div>
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>
      </div>

      {/* Tablet & Desktop: Horizontal Stepper */}
      <div className="hidden md:block">
        <Stepper
          activeStep={activeIndex}
          alternativeLabel
          connector={<HorizontalConnector />}
        >
          {items.map((title, idx) => {
            const status = computeStatus(idx, currentStage, total, isInterrupted);
            const StepIconWithStatus = (props) => (
              <StatusStepIcon {...props} status={status} />
            );

            return (
              <Step
                key={`${idx}-${title}`}
                completed={status === "done"}
                active={status === "active"}
                error={status === "failed"}
              >
                <StepLabel
                  slots={{ stepIcon: StepIconWithStatus }}
                  sx={{ "& .MuiStepLabel-label": { mt: 1 } }}
                >
                  <div className="flex flex-col items-center leading-tight">
                    <span
                      className="mb-1 text-xs capitalize"
                      style={{
                        color:
                          status === "done"
                            ? STATUS_COLORS.done
                            : status === "active"
                            ? STATUS_COLORS.active
                            : status === "failed"
                            ? STATUS_COLORS.failed
                            : "#6b7280",
                      }}
                    >
                      {status}
                    </span>
                    <span className="text-sm whitespace-pre-line">
                      {title === "Image Capture" ? "Aluminum Image\nCapture" : title}
                    </span>
                  </div>
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>
      </div>
    </div>
  );
}

UR2Stepper.propTypes = {
  stages: PropTypes.arrayOf(PropTypes.string),
  currentStage: PropTypes.number.isRequired,
  isInterrupted: PropTypes.bool,
};

UR2Stepper.defaultProps = {
  stages: undefined,
  isInterrupted: false,
};