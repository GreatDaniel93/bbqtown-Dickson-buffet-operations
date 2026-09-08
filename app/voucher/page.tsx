"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Voucher = {
  code: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  discountPercent: number;
};

const REVIEW_URL = "https://g.page/r/CUEVJmvZGEyeEAE/review";
const LOGO_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAkGBwgHBgkIBwgKCgkLDRYPDQwMDRsUFRAW