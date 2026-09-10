import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import leadsRouter from "./leads";
import customersRouter from "./customers";
import plansRouter from "./plans";
import paymentsRouter from "./payments";
import paymentsEkwanzaRouter from "./payments-ekwanza";
import integrationsRouter from "./integrations";
import webhooksRouter from "./webhooks";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import cademiRouter from "./cademi";
import ovgRouter from "./ovg";
import whatsappRouter from "./whatsapp";
import automationsRouter from "./automations";
import auditLogsRouter from "./audit-logs";
import settingsRouter from "./settings";
import apiKeysRouter from "./api-keys";
import accessRouter from "./access";
import checkinsRouter from "./checkins";
import solveAccessRouter from "./solve-access";
import { errorHandler, notFoundHandler } from "../middlewares/error";

const router: IRouter = Router();

// Health check
router.use(healthRouter);

// Auth (public)
router.use(authRouter);

// Protected routes
router.use(leadsRouter);
router.use(customersRouter);
router.use(plansRouter);
router.use(paymentsRouter);
router.use(paymentsEkwanzaRouter);
router.use(integrationsRouter);
router.use(webhooksRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(cademiRouter);
router.use(whatsappRouter);
router.use(ovgRouter);
router.use(automationsRouter);
router.use(auditLogsRouter);
router.use(settingsRouter);
router.use(apiKeysRouter);
router.use(accessRouter);
router.use(checkinsRouter);
router.use('/solve-access', solveAccessRouter);

// Error handling
router.use(notFoundHandler);
router.use(errorHandler);

export default router;
