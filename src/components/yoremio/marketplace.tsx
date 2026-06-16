"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { HubConnectionState, type HubConnection } from "@microsoft/signalr";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Clock3,
  Edit3,
  Filter,
  Heart,
  ImagePlus,
  Inbox,
  Leaf,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  PackageCheck,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Star,
  Store,
  Trash2,
  Truck,
  UploadCloud,
  UserRound,
  Users,
  Video,
  Wheat,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/yoremio/brand-logo";
import { bindChatEvents, createChatConnection } from "@/lib/chat";
import {
  ApiClientError,
  mediaUrl,
  yoremioApi,
  type CategoryDto,
  type ChatConversationDto,
  type ChatMessageDto,
  type DemandDto,
  type LoginResponse,
  type Paginated,
  type ProductDto,
  type ProductFormValues,
  type SellerProfileDto,
  type SellerTrustScoreDto,
  type SessionUser,
  type UserRole,
} from "@/lib/api";
import { cn, formatPrice, formatShortDate } from "@/lib/utils";

const PAGE_SIZE = 12;

const workspaces = [
  { id: "buyer", label: "Alıcı", icon: Heart },
  { id: "seller", label: "Satıcı", icon: Store },
  { id: "chat", label: "Chat", icon: MessageCircle },
] as const;

const categoryIcons: Record<number, LucideIcon> = {
  1: Leaf,
  2: Sparkles,
  3: PackageCheck,
  4: Wheat,
  5: ShoppingBasket,
};

const categoryTones = [
  "bg-emerald-50 text-emerald-800 border-emerald-200",
  "bg-rose-50 text-rose-800 border-rose-200",
  "bg-sky-50 text-sky-800 border-sky-200",
  "bg-violet-50 text-violet-800 border-violet-200",
  "bg-amber-50 text-amber-900 border-amber-200",
];

const productPlaceholderImage = "/products/product-placeholder.svg";

type Workspace = (typeof workspaces)[number]["id"];
type SortKey = "newest" | "rating" | "price";
type AuthState = SessionUser & Pick<LoginResponse, "token">;
type ToastKind = "success" | "error" | "info";
type ToastState = {
  kind: ToastKind;
  message: string;
} | null;
type LoadState = "idle" | "loading" | "error";

function emptyProductsResult(page = 1): Paginated<ProductDto> {
  return {
    items: [],
    page,
    pageSize: PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
  };
}

const emptyProductsPage: Paginated<ProductDto> = {
  items: [],
  page: 1,
  pageSize: PAGE_SIZE,
  totalCount: 0,
  totalPages: 1,
};

function apiErrorMessage(error: unknown) {
  return error instanceof ApiClientError
    ? error.message
    : "Beklenmeyen bir hata oluştu.";
}

function productImage(product: ProductDto) {
  const firstImage = product.resimler?.[0]?.url?.trim();

  if (!firstImage || firstImage.startsWith("/products/")) {
    return productPlaceholderImage;
  }

  const remote = mediaUrl(firstImage);
  if (remote) return remote;

  return productPlaceholderImage;
}

function categoryTone(categoryId: number) {
  return categoryTones[(categoryId - 1) % categoryTones.length];
}

function sellerName(product: ProductDto) {
  return product.saticiMagazaAdi ?? "Yöremio satıcısı";
}

function conversationName(conversation?: ChatConversationDto | null) {
  return conversation?.userName ?? conversation?.email ?? "Yöremio kullanıcısı";
}

function productLocation(product: ProductDto) {
  const parts = [product.saticiSehir, product.saticiIlce].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Konum belirtilmedi";
}

function roleLabel(role: UserRole) {
  return role === "SATICI" ? "Satıcı" : "Alıcı";
}

export function YoremioMarketplace() {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [workspace, setWorkspace] = useState<Workspace>("buyer");
  const [authOpen, setAuthOpen] = useState(false);
  const [authPreferredRole, setAuthPreferredRole] = useState<UserRole>("ALICI");
  const [authUser, setAuthUser] = useState<AuthState | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [productsPage, setProductsPage] =
    useState<Paginated<ProductDto>>(emptyProductsPage);
  const [marketState, setMarketState] = useState<LoadState>("idle");
  const [marketError, setMarketError] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [productDetail, setProductDetail] = useState<ProductDto | null>(null);
  const [trustScore, setTrustScore] = useState<SellerTrustScoreDto | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteProducts, setFavoriteProducts] = useState<ProductDto[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<ProductDto[]>([]);
  const [buyerDemands, setBuyerDemands] = useState<DemandDto[]>([]);
  const [sellerProfile, setSellerProfile] = useState<SellerProfileDto | null>(null);
  const [sellerProducts, setSellerProducts] = useState<ProductDto[]>([]);
  const [sellerDemands, setSellerDemands] = useState<DemandDto[]>([]);
  const [conversations, setConversations] = useState<ChatConversationDto[]>([]);
  const [chatTargetId, setChatTargetId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessageDto[]>([]);
  const [chatState, setChatState] = useState<LoadState>("idle");
  const [signalRState, setSignalRState] = useState("Kapalı");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const chatConnection = useRef<HubConnection | null>(null);

  const openSellerWorkspace = useCallback(() => {
    setWorkspace("seller");
    if (!authUser || authUser.role !== "SATICI") {
      setAuthPreferredRole("SATICI");
      setAuthOpen(true);
    }
    window.setTimeout(() => {
      document.getElementById("paneller")?.scrollIntoView({
        behavior: "smooth",
      });
    }, 50);
  }, [authUser]);

  const selectedProduct =
    productDetail ??
    (activeProductId === null
      ? undefined
      : productsPage.items.find((product) => product.id === activeProductId)) ??
    productsPage.items[0] ??
    null;

  const selectedCategory =
    categoryId === "all"
      ? undefined
      : categories.find((category) => category.id === categoryId);

  const showToast = useCallback((message: string, kind: ToastKind) => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 4600);
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem("yoremio-token");
    window.localStorage.removeItem("yoremio-user");
    setAuthUser(null);
    setFavoriteIds(new Set());
    setFavoriteProducts([]);
    setRecommendedProducts([]);
    setBuyerDemands([]);
    setSellerProfile(null);
    setSellerProducts([]);
    setSellerDemands([]);
    setConversations([]);
    setChatMessages([]);
    setChatTargetId("");
  }, []);

  const refreshSelectedProduct = useCallback(
    async (productId = activeProductId) => {
      if (productId === null) return;

      try {
        const freshProduct = await yoremioApi.product(productId);
        setProductDetail(freshProduct);
        setProductsPage((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === freshProduct.id ? freshProduct : item,
          ),
        }));
      } catch (error) {
        setMarketError(apiErrorMessage(error));
      }
    },
    [activeProductId],
  );

  const refreshRoleData = useCallback(async () => {
    if (!authUser) return;

    try {
      const nextConversations = await yoremioApi.conversations(authUser.token);
      setConversations(nextConversations);

      if (authUser.role === "ALICI") {
        const [favorites, recommended, demands] = await Promise.all([
          yoremioApi.favoriteProducts(authUser.token),
          yoremioApi.recommendedProducts(authUser.token),
          yoremioApi.buyerDemands(authUser.token),
        ]);
        setFavoriteProducts(favorites);
        setFavoriteIds(new Set(favorites.map((product) => product.id)));
        setRecommendedProducts(recommended);
        setBuyerDemands(demands);
      }

      if (authUser.role === "SATICI") {
        const [profile, products, demands] = await Promise.all([
          yoremioApi.sellerProfile(authUser.token),
          yoremioApi.sellerProducts(authUser.token),
          yoremioApi.sellerDemands(authUser.token),
        ]);
        setSellerProfile(profile);
        setSellerProducts(products);
        setSellerDemands(demands);
      }
    } catch (error) {
      const message = apiErrorMessage(error);
      showToast(message, "error");

      if (error instanceof ApiClientError && error.status === 401) {
        clearSession();
      }
    }
  }, [authUser, clearSession, showToast]);

  useEffect(() => {
    const token = window.localStorage.getItem("yoremio-token");
    if (!token) return;

    let ignore = false;

    yoremioApi
      .me(token)
      .then((user) => {
        if (ignore) return;

        const session: LoginResponse = {
          token,
          userId: user.userId,
          email: user.email,
          role: user.role,
        };

        window.localStorage.setItem("yoremio-user", JSON.stringify(session));
        setAuthUser({
          ...user,
          token,
        });
      })
      .catch(() => {
        if (!ignore) clearSession();
      });

    return () => {
      ignore = true;
    };
  }, [clearSession]);

  useEffect(() => {
    let ignore = false;

    yoremioApi
      .categories()
      .then((nextCategories) => {
        if (!ignore) setCategories(nextCategories);
      })
      .catch((error) => {
        if (!ignore) {
          setCategories([]);
          showToast(apiErrorMessage(error), "error");
        }
      });

    return () => {
      ignore = true;
    };
  }, [showToast]);

  useEffect(() => {
    let ignore = false;
    setMarketState("loading");

    yoremioApi
      .products({
        page,
        pageSize: PAGE_SIZE,
        q: query.trim() || undefined,
        kategoriId: categoryId === "all" ? undefined : categoryId,
        sadeceStoktaOlanlar: inStockOnly,
        sort,
      })
      .then((nextPage) => {
        if (ignore) return;
        const normalizedPage = {
          ...nextPage,
          totalPages: Math.max(1, nextPage.totalPages),
        };

        setProductsPage(normalizedPage);
        setMarketState("idle");
        setMarketError(null);

        if (normalizedPage.items.length === 0) {
          setActiveProductId(null);
          setProductDetail(null);
          setDetailOpen(false);
          return;
        }

        if (!normalizedPage.items.some((product) => product.id === activeProductId)) {
          setActiveProductId(normalizedPage.items[0].id);
        }
      })
      .catch((error) => {
        if (ignore) return;
        setProductsPage(emptyProductsResult(page));
        setActiveProductId(null);
        setProductDetail(null);
        setDetailOpen(false);
        setMarketState("error");
        setMarketError(apiErrorMessage(error));
      });

    return () => {
      ignore = true;
    };
  }, [activeProductId, categoryId, inStockOnly, page, query, sort]);

  useEffect(() => {
    setPage(1);
  }, [categoryId, inStockOnly, query, sort]);

  useEffect(() => {
    let ignore = false;
    setProductDetail(null);

    if (activeProductId === null) return;

    yoremioApi
      .product(activeProductId)
      .then((product) => {
        if (!ignore) setProductDetail(product);
      })
      .catch(() => {
        if (!ignore) setProductDetail(null);
      });

    return () => {
      ignore = true;
    };
  }, [activeProductId]);

  useEffect(() => {
    let ignore = false;

    if (!selectedProduct?.saticiId) {
      setTrustScore(null);
      return;
    }

    yoremioApi
      .sellerTrustScore(selectedProduct.saticiId)
      .then((score) => {
        if (!ignore) setTrustScore(score);
      })
      .catch(() => {
        if (!ignore) setTrustScore(null);
      });

    return () => {
      ignore = true;
    };
  }, [selectedProduct?.saticiId]);

  useEffect(() => {
    void refreshRoleData();
  }, [refreshRoleData]);

  useEffect(() => {
    if (!authUser?.token) {
      setSignalRState("Kapalı");
      return;
    }

    let disposed = false;
    const connection = createChatConnection(() => authUser.token);
    chatConnection.current = connection;

    const unbind = bindChatEvents(connection, {
      onReceive: (message) => {
        setChatMessages((current) => {
          const belongsToOpenChat =
            message.senderId === chatTargetId || message.receiverId === chatTargetId;
          if (!belongsToOpenChat) return current;
          if (current.some((item) => item.id === message.id)) return current;
          return [...current, message];
        });
        void refreshRoleData();
      },
      onSent: (message) => {
        setChatMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current;
          return [...current, message];
        });
        void refreshRoleData();
      },
      onRead: (readerUserId, readAtUtc) => {
        setChatMessages((current) =>
          current.map((message) =>
            message.receiverId === readerUserId && !message.readAt
              ? { ...message, readAt: readAtUtc }
              : message,
          ),
        );
      },
      onTyping: (fromUserId) => {
        if (fromUserId === chatTargetId) {
          setSignalRState("Yazıyor");
          window.setTimeout(() => setSignalRState("Canlı"), 1600);
        }
      },
    });

    setSignalRState("Bağlanıyor");
    const startPromise = connection
      .start()
      .then(async () => {
        if (disposed) {
          if (connection.state !== HubConnectionState.Disconnected) {
            await connection.stop();
          }
          return;
        }

        setSignalRState("Canlı");
      })
      .catch(() => {
        if (!disposed) setSignalRState("REST");
      });

    return () => {
      disposed = true;
      unbind();
      if (chatConnection.current === connection) {
        chatConnection.current = null;
      }

      void startPromise.finally(() => {
        if (connection.state !== HubConnectionState.Disconnected) {
          void connection.stop();
        }
      });
    };
  }, [authUser?.token, chatTargetId, refreshRoleData]);

  useEffect(() => {
    if (!chatTargetId && conversations[0]?.userId) {
      setChatTargetId(conversations[0].userId);
    }
  }, [chatTargetId, conversations]);

  useEffect(() => {
    let ignore = false;

    if (!authUser?.token || !chatTargetId) {
      setChatMessages([]);
      return;
    }

    setChatState("loading");
    yoremioApi
      .messages(authUser.token, chatTargetId)
      .then((messages) => {
        if (ignore) return;
        setChatMessages(messages.items);
        setChatState("idle");
        void yoremioApi.markConversationRead(authUser.token, chatTargetId);
      })
      .catch((error) => {
        if (ignore) return;
        setChatMessages([]);
        setChatState("error");
        showToast(apiErrorMessage(error), "error");
      });

    return () => {
      ignore = true;
    };
  }, [authUser?.token, chatTargetId, showToast]);

  const requireAuth = (role?: UserRole) => {
    if (!authUser) {
      setAuthOpen(true);
      showToast("Bu işlem için giriş yapmalısın.", "info");
      return false;
    }

    if (role && authUser.role !== role) {
      showToast(`Bu işlem ${roleLabel(role)} rolü gerektirir.`, "error");
      return false;
    }

    return true;
  };

  const handleFavorite = async (product: ProductDto) => {
    if (!requireAuth("ALICI")) return;
    if (!authUser) return;

    const isFavorite = favoriteIds.has(product.id);
    setActionStatus(`favorite-${product.id}`);

    try {
      if (isFavorite) {
        await yoremioApi.removeFavorite(authUser.token, product.id);
      } else {
        await yoremioApi.addFavorite(authUser.token, product.id);
      }

      setFavoriteIds((current) => {
        const next = new Set(current);
        if (isFavorite) next.delete(product.id);
        else next.add(product.id);
        return next;
      });
      await refreshSelectedProduct(product.id);
      await refreshRoleData();
      showToast(isFavorite ? "Favoriden çıkarıldı." : "Favoriye eklendi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleDemand = async (urunId: number, miktar: number, note?: string) => {
    if (!requireAuth("ALICI")) return;
    if (!authUser) return;

    setActionStatus(`demand-${urunId}`);
    try {
      await yoremioApi.createDemand(authUser.token, urunId, miktar, note);
      await refreshRoleData();
      showToast("Talep satıcıya gönderildi.", "success");
      setWorkspace("buyer");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleRating = async (urunId: number, rating: number) => {
    if (!requireAuth("ALICI")) return;
    if (!authUser) return;

    setActionStatus(`rating-${urunId}`);
    try {
      await yoremioApi.rateProduct(authUser.token, urunId, rating);
      await refreshSelectedProduct(urunId);
      showToast("Puan kaydedildi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleComment = async (urunId: number, content: string) => {
    if (!requireAuth("ALICI")) return;
    if (!authUser) return;

    setActionStatus(`comment-${urunId}`);
    try {
      await yoremioApi.addComment(authUser.token, urunId, content);
      await refreshSelectedProduct(urunId);
      showToast("Yorum eklendi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleDeleteComment = async (commentId: number, urunId: number) => {
    if (!requireAuth("ALICI")) return;
    if (!authUser) return;
    if (!window.confirm("Yorumu silmek istiyor musun?")) return;

    setActionStatus(`delete-comment-${commentId}`);
    try {
      await yoremioApi.deleteComment(authUser.token, commentId);
      await refreshSelectedProduct(urunId);
      showToast("Yorum silindi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleAcceptOffer = async (offerId: number) => {
    if (!requireAuth("ALICI")) return;
    if (!authUser) return;

    setActionStatus(`accept-${offerId}`);
    try {
      await yoremioApi.acceptOffer(authUser.token, offerId);
      await refreshRoleData();
      showToast("Teklif kabul edildi. Talep anlaşma durumuna geçti.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleProfileUpdate = async (values: {
    magazaAdi: string;
    adres: string;
    sehir: string;
    ilce: string;
    phoneNumber: string;
  }) => {
    if (!requireAuth("SATICI")) return;
    if (!authUser) return;

    setActionStatus("profile");
    try {
      const profile = await yoremioApi.updateSellerProfile(authUser.token, values);
      setSellerProfile(profile);
      showToast("Satıcı profili güncellendi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleProductSave = async (
    values: ProductFormValues,
    productId?: number,
  ) => {
    if (!requireAuth("SATICI")) return;
    if (!authUser) return;

    setActionStatus("product-form");
    try {
      const product = await yoremioApi.upsertProduct(authUser.token, values, productId);
      await refreshRoleData();
      await refreshSelectedProduct(product.id);
      setActiveProductId(product.id);
      setDetailOpen(true);
      showToast(productId ? "Ürün güncellendi." : "Ürün eklendi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleProductDelete = async (urunId: number) => {
    if (!requireAuth("SATICI")) return;
    if (!authUser) return;
    if (!window.confirm("Bu ürünü silmek istiyor musun?")) return;

    setActionStatus(`delete-product-${urunId}`);
    try {
      await yoremioApi.deleteProduct(authUser.token, urunId);
      await refreshRoleData();
      setProductsPage((current) => ({
        ...current,
        items: current.items.filter((product) => product.id !== urunId),
      }));
      if (activeProductId === urunId) {
        setActiveProductId(null);
        setProductDetail(null);
        setDetailOpen(false);
      }
      showToast("Ürün silindi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleDeleteMedia = async (
    urunId: number,
    mediaId: number,
    kind: "image" | "video",
  ) => {
    if (!requireAuth("SATICI")) return;
    if (!authUser) return;
    if (!window.confirm("Bu medyayı silmek istiyor musun?")) return;

    setActionStatus(`media-${mediaId}`);
    try {
      if (kind === "image") {
        await yoremioApi.deleteProductImage(authUser.token, urunId, mediaId);
      } else {
        await yoremioApi.deleteProductVideo(authUser.token, urunId, mediaId);
      }

      await refreshRoleData();
      await refreshSelectedProduct(urunId);
      showToast("Medya silindi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleOffer = async (
    talepId: number,
    values: { birimFiyat?: number; mesaj: string },
  ) => {
    if (!requireAuth("SATICI")) return;
    if (!authUser) return;

    setActionStatus(`offer-${talepId}`);
    try {
      await yoremioApi.upsertOffer(authUser.token, talepId, values);
      await refreshRoleData();
      showToast("Teklif gönderildi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleCategorySave = async (
    values: { adi: string; aciklama: string },
    categoryToUpdate?: number,
  ) => {
    if (!requireAuth("SATICI")) return;
    if (!authUser) return;

    setActionStatus("category");
    try {
      if (categoryToUpdate) {
        await yoremioApi.updateCategory(authUser.token, categoryToUpdate, values);
      } else {
        await yoremioApi.createCategory(authUser.token, values);
      }
      const nextCategories = await yoremioApi.categories();
      setCategories(nextCategories);
      showToast(
        categoryToUpdate ? "Kategori güncellendi." : "Kategori oluşturuldu.",
        "success",
      );
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleCategoryDelete = async (id: number) => {
    if (!requireAuth("SATICI")) return;
    if (!authUser) return;
    if (!window.confirm("Bu kategoriyi silmek istiyor musun?")) return;

    setActionStatus("category");
    try {
      await yoremioApi.deleteCategory(authUser.token, id);
      setCategories((current) => current.filter((category) => category.id !== id));
      showToast("Kategori silindi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const handleOpenChat = (sellerId: string) => {
    if (!requireAuth()) return;
    setChatTargetId(sellerId);
    setWorkspace("chat");
    setDetailOpen(false);
    window.setTimeout(() => {
      document.getElementById("paneller")?.scrollIntoView({
        behavior: "smooth",
      });
    }, 50);
  };

  const handleSendMessage = async (receiverId: string, message: string) => {
    if (!requireAuth()) return;
    if (!authUser) return;

    setActionStatus("chat-send");
    try {
      const connection = chatConnection.current;

      if (connection?.state === HubConnectionState.Connected) {
        try {
          await connection.invoke("SendMessage", receiverId, message);
        } catch {
          const sent = await yoremioApi.sendMessage(authUser.token, receiverId, message);
          setChatMessages((current) => [...current, sent]);
        }
      } else {
        const sent = await yoremioApi.sendMessage(authUser.token, receiverId, message);
        setChatMessages((current) => [...current, sent]);
      }

      setChatTargetId(receiverId);
      await refreshRoleData();
      showToast("Mesaj gönderildi.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    } finally {
      setActionStatus(null);
    }
  };

  const totalOpenSellerDemands = sellerDemands.filter(
    (demand) => demand.durum === "ACIK",
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader
        authUser={authUser}
        onLoginClick={() => {
          setAuthPreferredRole("ALICI");
          setAuthOpen(true);
        }}
        onSellerPanelClick={openSellerWorkspace}
        onLogout={clearSession}
      />

      <main>
        <section className="relative isolate overflow-hidden border-b border-border">
          <Image
            src="/hero-market-1600.jpg"
            alt="Yöremio yerel ürün vitrini"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,254,250,0.96)_0%,rgba(255,254,250,0.86)_29%,rgba(255,254,250,0.36)_58%,rgba(16,42,32,0.1)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

          <div className="relative mx-auto flex min-h-[660px] max-w-[1680px] flex-col justify-between px-4 py-9 sm:px-6 lg:py-12">
            <div className="max-w-3xl pt-8 lg:pt-16">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="green">
                  <Leaf className="size-3.5" aria-hidden />
                  Canlı yerel pazar
                </Badge>
                <Badge variant="outline">
                  {productsPage.totalCount > 0
                    ? `${productsPage.totalCount} ürün yayında`
                    : "Vitrin ürün bekliyor"}
                </Badge>
              </div>

              <h1 className="mt-6 font-serif text-[2.8rem] font-black leading-[0.98] text-brand-brown sm:text-6xl lg:text-[5.9rem]">
                Yöremio
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-foreground/[0.75] sm:text-xl">
                Yerel üreticiden taze ürünü keşfet, güven skorunu gör,
                satıcıyla konuş ve talebini gerçek API akışıyla netleştir.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  variant="premium"
                  className="h-[52px] px-6"
                  onClick={() =>
                    document.getElementById("kesif")?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                >
                  <ShoppingBasket aria-hidden />
                  Pazarı keşfet
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-[52px] bg-white/[0.8] px-6"
                  onClick={openSellerWorkspace}
                >
                  <Store aria-hidden />
                  Satıcı paneli
                </Button>
              </div>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                <HeroSignal icon={ShieldCheck} label="Güven skoru" value="Satıcı profili" />
                <HeroSignal icon={PackagePlus} label="Ürün akışı" value="Gerçek stok" />
                <HeroSignal icon={MessageCircle} label="Görüşme" value="Canlı mesaj" />
              </div>
            </div>

            <form
              className="mb-2 max-w-5xl overflow-hidden rounded-lg border border-white/[0.7] bg-white/[0.9] shadow-[0_30px_90px_rgba(32,24,15,0.18)] backdrop-blur-xl"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="grid gap-2 p-2 md:grid-cols-[minmax(0,1fr)_180px_130px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Bal, peynir, domates, şehir veya satıcı ara"
                    className="h-[60px] border-0 bg-transparent pl-12 text-base shadow-none focus-visible:ring-0"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className="h-[60px] rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                >
                  <option value="newest">En yeni</option>
                  <option value="rating">En yüksek puan</option>
                  <option value="price">Artan fiyat</option>
                </select>
                <Button size="lg" variant="default" className="h-[60px]">
                  {marketState === "loading" ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Search aria-hidden />
                  )}
                  Ara
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section id="kesif" className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6">
          <div className="space-y-6">
            <CategoryShelf
              categories={categories}
              activeId={categoryId}
              onSelect={setCategoryId}
              selectedCategory={selectedCategory}
            />

            <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Pazar vitrini
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-normal text-brand-brown">
                  Üreticiden gelen canlı ürünler
                </h2>
                {marketError ? (
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-red-700">
                    <AlertTriangle className="size-4" aria-hidden />
                    {marketError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <Filter className="size-4 text-primary" aria-hidden />
                  <span className="text-sm font-semibold text-muted-foreground">
                    {productsPage.totalCount} sonuç
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={inStockOnly}
                  onClick={() => setInStockOnly(!inStockOnly)}
                  className="flex h-10 items-center justify-between gap-3 rounded-md border border-border bg-background px-3 text-sm font-semibold"
                >
                  Stokta olanlar
                  <span
                    className={cn(
                      "relative h-5 w-9 rounded-full transition",
                      inStockOnly ? "bg-primary" : "bg-muted-foreground/[0.3]",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 size-3 rounded-full bg-white shadow transition",
                        inStockOnly ? "left-5" : "left-1",
                      )}
                    />
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-5">
                {productsPage.items.length > 0 ? (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {productsPage.items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        category={categories.find(
                          (category) => category.id === product.kategoriId,
                        )}
                        active={product.id === selectedProduct?.id}
                        isFavorite={favoriteIds.has(product.id)}
                        onSelect={() => {
                          setActiveProductId(product.id);
                          setDetailOpen(true);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <MarketEmptyState
                    icon={Search}
                    hasError={Boolean(marketError)}
                    onClearFilters={() => {
                      setQuery("");
                      setCategoryId("all");
                      setInStockOnly(false);
                      setSort("newest");
                    }}
                    onSellerPanelClick={openSellerWorkspace}
                    title="Sonuç bulunamadı."
                    description="Arama, kategori veya stok filtresini değiştir."
                  />
                )}

                {productsPage.items.length > 0 ? (
                  <PaginationBar
                    page={productsPage.page}
                    totalPages={productsPage.totalPages}
                    onPageChange={setPage}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section id="paneller" className="border-t border-border bg-white">
          <WorkspaceSection
            workspace={workspace}
            setWorkspace={setWorkspace}
            authUser={authUser}
            selectedProduct={selectedProduct}
            categories={categories}
            recommendedProducts={recommendedProducts}
            favoriteProducts={favoriteProducts}
            buyerDemands={buyerDemands}
            sellerProfile={sellerProfile}
            sellerProducts={sellerProducts}
            sellerDemands={sellerDemands}
            totalOpenSellerDemands={totalOpenSellerDemands}
            conversations={conversations}
            chatMessages={chatMessages}
            chatTargetId={chatTargetId}
            chatState={chatState}
            signalRState={signalRState}
            actionStatus={actionStatus}
            onLogin={() => setAuthOpen(true)}
            onSelectProduct={(id) => {
              setActiveProductId(id);
              setDetailOpen(true);
            }}
            onDemand={handleDemand}
            onAcceptOffer={handleAcceptOffer}
            onProfileUpdate={handleProfileUpdate}
            onProductSave={handleProductSave}
            onProductDelete={handleProductDelete}
            onDeleteMedia={handleDeleteMedia}
            onOffer={handleOffer}
            onCategorySave={handleCategorySave}
            onCategoryDelete={handleCategoryDelete}
            onChatTargetChange={setChatTargetId}
            onSendMessage={handleSendMessage}
          />
        </section>
      </main>

      {selectedProduct ? (
        <ProductDetailDialog
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
        >
          <ProductDetail
            product={selectedProduct}
            trustScore={trustScore}
            category={categories.find(
              (category) => category.id === selectedProduct.kategoriId,
            )}
            authUser={authUser}
            isFavorite={favoriteIds.has(selectedProduct.id)}
            actionStatus={actionStatus}
            onFavorite={handleFavorite}
            onDemand={handleDemand}
            onRate={handleRating}
            onComment={handleComment}
            onDeleteComment={handleDeleteComment}
            onOpenChat={handleOpenChat}
          />
        </ProductDetailDialog>
      ) : null}

      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}

      <AuthDialog
        key={authPreferredRole}
        open={authOpen}
        initialRole={authPreferredRole}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={(user) => {
          setAuthUser(user);
          setAuthOpen(false);
          showToast(`${roleLabel(user.role)} hesabıyla giriş yapıldı.`, "success");
        }}
      />
    </div>
  );
}

function HeroSignal({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/70 bg-white/75 px-3 py-3 shadow-sm backdrop-blur">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-sm font-black text-brand-brown">
          {value}
        </span>
      </span>
    </div>
  );
}

function AppHeader({
  authUser,
  onLoginClick,
  onSellerPanelClick,
  onLogout,
}: {
  authUser: AuthState | null;
  onLoginClick: () => void;
  onSellerPanelClick: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 shadow-[0_8px_30px_rgba(32,24,15,0.05)] backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1680px] items-center justify-between gap-3 px-4 sm:px-6">
        <BrandLogo compact />
        <nav className="hidden items-center gap-1 rounded-md border border-border bg-background/80 p-1 text-sm font-semibold text-muted-foreground lg:flex">
          <a className="rounded-md px-4 py-2 transition hover:bg-white hover:text-primary" href="#kesif">
            Pazar
          </a>
          <a className="rounded-md px-4 py-2 transition hover:bg-white hover:text-primary" href="#paneller">
            Panel
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={onSellerPanelClick}
          >
            <PackagePlus aria-hidden />
            Ürün ekle
          </Button>
          {authUser ? (
            <>
              <Button variant="outline" className="hidden max-w-72 md:inline-flex">
                <UserRound aria-hidden />
                <span className="truncate">
                  {authUser.email} · {roleLabel(authUser.role)}
                </span>
              </Button>
              <Button
                variant="default"
                size="icon"
                title="Çıkış yap"
                onClick={onLogout}
              >
                <LogOut aria-hidden />
              </Button>
            </>
          ) : (
            <Button variant="default" onClick={onLoginClick}>
              <UserRound aria-hidden />
              Giriş yap
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function AuthDialog({
  open,
  initialRole,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  initialRole: UserRole;
  onClose: () => void;
  onAuthenticated: (user: AuthState) => void;
}) {
  const [mode, setMode] = useState<"login" | "buyer" | "seller" | "verify">("login");
  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [magazaAdi, setMagazaAdi] = useState("");
  const [vergiNo, setVergiNo] = useState("");
  const [adres, setAdres] = useState("");
  const [sehir, setSehir] = useState("");
  const [ilce, setIlce] = useState("");
  const [verifyUserId, setVerifyUserId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyType, setVerifyType] = useState<"email" | "phone">("email");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const chooseLoginRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setMode("login");
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setMessage(null);

    try {
      if (mode === "login") {
        const login = await yoremioApi.login(email.trim(), password);
        window.localStorage.setItem("yoremio-token", login.token);
        window.localStorage.setItem("yoremio-user", JSON.stringify(login));

        let fullUser: AuthState = {
          token: login.token,
          userId: login.userId,
          email: login.email,
          userName: login.email,
          role: login.role,
          emailConfirmed: false,
          phoneNumberConfirmed: false,
        };

        try {
          const me = await yoremioApi.me(login.token);
          fullUser = { ...me, token: login.token };
        } catch {
          // Login token is still usable; session bootstrap will retry /me later.
        }

        setStatus("success");
        onAuthenticated(fullUser);
        return;
      }

      if (mode === "buyer") {
        await yoremioApi.registerBuyer({ email: email.trim(), password });
        setMessage("Alıcı kaydı oluşturuldu. Doğrulama linkini kontrol et.");
        setMode("login");
        setPassword("");
      }

      if (mode === "seller") {
        await yoremioApi.registerSeller({
          email: email.trim(),
          password,
          phoneNumber,
          magazaAdi,
          vergiNo,
          adres,
          sehir,
          ilce,
        });
        setMessage(
          "Satıcı kaydı oluşturuldu. Email ve telefon doğrulaması tamamlanınca giriş yapabilirsin.",
        );
        setMode("login");
        setPassword("");
      }

      if (mode === "verify") {
        if (verifyType === "email") {
          await yoremioApi.confirmEmail(verifyUserId, verifyToken);
        } else {
          await yoremioApi.confirmPhone(verifyUserId, verifyToken);
        }
        setMessage("Doğrulama tamamlandı.");
      }

      setStatus("success");
    } catch (caught) {
      setError(apiErrorMessage(caught));
      setStatus("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/[0.42] px-4 py-6 backdrop-blur-sm">
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg border border-border bg-white shadow-[0_30px_100px_rgba(0,0,0,0.28)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <div className="flex items-center justify-between border-b border-border bg-background px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Yöremio hesabı
            </p>
            <h2 id="auth-title" className="mt-1 text-xl font-black text-brand-brown">
              {mode === "login"
                ? "Giriş yap"
                : mode === "buyer"
                  ? "Alıcı kaydı"
                  : mode === "seller"
                    ? "Satıcı kaydı"
                    : "Doğrulama"}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Kapat">
            <X aria-hidden />
          </Button>
        </div>

        <form className="space-y-4 p-5" onSubmit={handleSubmit}>
          <div className="grid gap-2 sm:grid-cols-4">
            <Button
              type="button"
              variant={mode === "login" && role === "ALICI" ? "default" : "outline"}
              onClick={() => chooseLoginRole("ALICI")}
            >
              <Heart aria-hidden />
              Alıcı
            </Button>
            <Button
              type="button"
              variant={mode === "login" && role === "SATICI" ? "default" : "outline"}
              onClick={() => chooseLoginRole("SATICI")}
            >
              <Store aria-hidden />
              Satıcı
            </Button>
            <Button
              type="button"
              variant={mode === "buyer" ? "default" : "outline"}
              onClick={() => {
                setRole("ALICI");
                setMode("buyer");
              }}
            >
              <Plus aria-hidden />
              Alıcı kayıt
            </Button>
            <Button
              type="button"
              variant={mode === "seller" ? "default" : "outline"}
              onClick={() => {
                setRole("SATICI");
                setMode("seller");
              }}
            >
              <UploadCloud aria-hidden />
              Satıcı kayıt
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-posta" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="ornek@mail.com"
                required={mode !== "verify"}
              />
            </Field>
            <Field label="Şifre" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="En az 6 karakter"
                required={mode !== "verify"}
              />
            </Field>
          </div>

          {mode === "seller" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefon" htmlFor="seller-phone">
                <Input
                  id="seller-phone"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  required
                />
              </Field>
              <Field label="Mağaza adı" htmlFor="seller-store">
                <Input
                  id="seller-store"
                  value={magazaAdi}
                  onChange={(event) => setMagazaAdi(event.target.value)}
                  required
                />
              </Field>
              <Field label="Vergi no" htmlFor="seller-tax">
                <Input
                  id="seller-tax"
                  value={vergiNo}
                  onChange={(event) => setVergiNo(event.target.value)}
                  required
                />
              </Field>
              <Field label="Adres" htmlFor="seller-address">
                <Input
                  id="seller-address"
                  value={adres}
                  onChange={(event) => setAdres(event.target.value)}
                />
              </Field>
              <Field label="Şehir" htmlFor="seller-city">
                <Input
                  id="seller-city"
                  value={sehir}
                  onChange={(event) => setSehir(event.target.value)}
                />
              </Field>
              <Field label="İlçe" htmlFor="seller-district">
                <Input
                  id="seller-district"
                  value={ilce}
                  onChange={(event) => setIlce(event.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {mode === "verify" ? (
            <div className="grid gap-3 sm:grid-cols-[150px_1fr_1fr]">
              <Field label="Tür" htmlFor="verify-type">
                <select
                  id="verify-type"
                  value={verifyType}
                  onChange={(event) =>
                    setVerifyType(event.target.value as "email" | "phone")
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                >
                  <option value="email">Email</option>
                  <option value="phone">Telefon</option>
                </select>
              </Field>
              <Field label="User ID" htmlFor="verify-user">
                <Input
                  id="verify-user"
                  value={verifyUserId}
                  onChange={(event) => setVerifyUserId(event.target.value)}
                  required
                />
              </Field>
              <Field label="Token" htmlFor="verify-token">
                <Input
                  id="verify-token"
                  value={verifyToken}
                  onChange={(event) => setVerifyToken(event.target.value)}
                  required
                />
              </Field>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              {message}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode(mode === "verify" ? "login" : "verify")}
            >
              <ShieldCheck aria-hidden />
              {mode === "verify" ? "Girişe dön" : "Doğrulama ekranı"}
            </Button>
            <Button type="submit" disabled={status === "loading"}>
              {status === "loading" ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  İşleniyor
                </>
              ) : (
                <>
                  <Check aria-hidden />
                  {mode === "login" ? "Giriş yap" : "Gönder"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryShelf({
  categories,
  activeId,
  onSelect,
  selectedCategory,
}: {
  categories: CategoryDto[];
  activeId: number | "all";
  onSelect: (value: number | "all") => void;
  selectedCategory?: CategoryDto;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-bold text-brand-brown">
            {selectedCategory?.adi ?? "Tüm kategoriler"}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedCategory?.aciklama ??
              "Sebze, meyve, süt ürünleri, bakliyat ve kahvaltılık"}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <ArrowRight aria-hidden />
          Liste
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3">
        <CategoryChip
          active={activeId === "all"}
          icon={ShoppingBasket}
          label="Tümü"
          onClick={() => onSelect("all")}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            active={activeId === category.id}
            icon={categoryIcons[category.id] ?? Leaf}
            label={category.adi}
            onClick={() => onSelect(category.id)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-bold transition",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-foreground hover:bg-secondary/60",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

function MarketEmptyState({
  icon: Icon = Search,
  title,
  description,
  hasError,
  onClearFilters,
  onSellerPanelClick,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  hasError: boolean;
  onClearFilters: () => void;
  onSellerPanelClick: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-dashed border-border bg-white shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px] lg:items-center">
        <div>
          <div className="grid size-12 place-items-center rounded-md bg-secondary text-primary">
            <Icon className="size-6" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {hasError ? "API bağlantısı kontrol edilmeli" : "Vitrin boş"}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-normal text-brand-brown">
            {title ?? "Henüz yayında ürün yok."}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description ??
              "Yöremio gerçek veriyi gösterir. Veritabanında ürün yoksa kullanıcıya rastgele demo ürün basılmaz."}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="premium" onClick={onSellerPanelClick}>
              <PackagePlus aria-hidden />
              Ürün ekle
            </Button>
            <Button type="button" variant="outline" onClick={onClearFilters}>
              <Filter aria-hidden />
              Filtreleri temizle
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-bold text-brand-brown">Yayın hazır kontrol</p>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Check className="size-4 text-primary" aria-hidden />
              API boş dönerse demo ürün gösterilmez.
            </p>
            <p className="flex items-center gap-2">
              <Check className="size-4 text-primary" aria-hidden />
              Satıcı panelinden gerçek ürün eklenir.
            </p>
            <p className="flex items-center gap-2">
              <Check className="size-4 text-primary" aria-hidden />
              Liste dolunca detay, talep ve chat akışına bağlanır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDetailDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 p-3 backdrop-blur-sm sm:p-5">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Detay panelini kapat"
        onClick={onClose}
      />
      <div
        className="relative ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-[0_30px_100px_rgba(0,0,0,0.32)]"
        role="dialog"
        aria-modal="true"
        aria-label="Ürün detayı"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Ürün detayı
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} title="Kapat">
            <X aria-hidden />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  category,
  active,
  isFavorite,
  onSelect,
}: {
  product: ProductDto;
  category?: CategoryDto;
  active: boolean;
  isFavorite: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      className={cn(
        "group min-w-0 cursor-pointer overflow-hidden rounded-lg border bg-card text-left shadow-sm outline-none transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(32,24,15,0.13)] focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary ring-2 ring-primary/[0.14]"
          : "border-border hover:border-primary/[0.35]",
      )}
    >
      <div className="relative aspect-[1.22] overflow-hidden bg-muted">
        <Image
          src={productImage(product)}
          alt={product.adi}
          fill
          sizes="(min-width: 1536px) 290px, (min-width: 768px) 45vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/[0.45] to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {category ? (
            <span
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-bold shadow-sm",
                categoryTone(category.id),
              )}
            >
              {category.adi}
            </span>
          ) : null}
          {product.stokMiktari === 0 ? (
            <Badge variant="gold">Ön sipariş</Badge>
          ) : null}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            <p className="line-clamp-1 text-lg font-black">{product.adi}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-white/[0.85]">
              <MapPin className="size-3.5" aria-hidden />
              {productLocation(product)}
            </p>
          </div>
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md bg-white/[0.92] shadow-sm",
              isFavorite ? "text-red-600" : "text-primary",
            )}
          >
            <Heart
              className={cn("size-4", isFavorite && "fill-current")}
              aria-hidden
            />
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {product.aciklama}
        </p>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="min-w-0">
            <p className="text-xl font-black text-primary">
              {formatPrice(product.fiyat)}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {product.stokMiktari > 0 ? `${product.stokMiktari} stok` : "Sırada"} ·
              ID {product.id}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background px-2 py-1 text-right">
            <p className="flex items-center gap-1 text-sm font-black text-brand-brown">
              <Star className="size-3.5 fill-accent text-accent" aria-hidden />
              {product.ortalamaPuan.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">
              {product.toplamYorum} yorum
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{sellerName(product)}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {product.saticiDogrulanmis ? (
                <BadgeCheck className="size-3.5 text-primary" aria-hidden />
              ) : null}
              {product.toplamFavori} favori
            </p>
          </div>
          <Button size="sm" variant={active ? "default" : "outline"}>
            İncele
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProductDetail({
  product,
  category,
  trustScore,
  authUser,
  isFavorite,
  actionStatus,
  onFavorite,
  onDemand,
  onRate,
  onComment,
  onDeleteComment,
  onOpenChat,
}: {
  product: ProductDto;
  category?: CategoryDto;
  trustScore: SellerTrustScoreDto | null;
  authUser: AuthState | null;
  isFavorite: boolean;
  actionStatus: string | null;
  onFavorite: (product: ProductDto) => void;
  onDemand: (urunId: number, miktar: number, note?: string) => void;
  onRate: (urunId: number, rating: number) => void;
  onComment: (urunId: number, content: string) => void;
  onDeleteComment: (commentId: number, urunId: number) => void;
  onOpenChat: (sellerId: string) => void;
}) {
  const [miktar, setMiktar] = useState(1);
  const [note, setNote] = useState("Hafta sonu teslim alabilirim.");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const shownTrust = trustScore?.guvenSkoru ?? (product.saticiDogrulanmis ? 84 : 62);

  useEffect(() => {
    setMiktar(1);
    setComment("");
  }, [product.id]);

  return (
    <aside
      id="detay"
      className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_22px_55px_rgba(32,24,15,0.12)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={productImage(product)}
          alt={product.adi}
          fill
          sizes="450px"
          className="object-cover"
          priority
        />
        <div className="absolute left-4 top-4 flex gap-2">
          <Badge variant={product.stokMiktari > 0 ? "green" : "gold"}>
            {product.stokMiktari > 0 ? "Stokta" : "Ön sipariş"}
          </Badge>
          {category ? <Badge variant="outline">{category.adi}</Badge> : null}
        </div>
      </div>

      <div className="space-y-5 p-4">
        <div>
          <p className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            <MapPin className="size-4" aria-hidden />
            {productLocation(product)}
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight tracking-normal text-brand-brown">
            {product.adi}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {product.aciklama}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="Puan" value={product.ortalamaPuan.toFixed(1)} icon={Star} />
          <Metric label="Yorum" value={String(product.toplamYorum)} icon={MessageCircle} />
          <Metric label="Favori" value={String(product.toplamFavori)} icon={Heart} />
        </div>

        <div className="rounded-lg border border-border bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Satıcı
              </p>
              <h3 className="mt-1 truncate font-bold">{sellerName(product)}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                {product.saticiDogrulanmis ? (
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                ) : null}
                {trustScore?.urunSayisi ?? "Canlı"} ürün · {product.saticiId.slice(0, 8)}
              </p>
            </div>
            <TrustDial score={shownTrust} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-[#102a20] p-4 text-white">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-emerald-50/[0.7]">Birim fiyat</p>
              <p className="text-2xl font-black">{formatPrice(product.fiyat)}</p>
            </div>
            <p className="text-right text-xs font-semibold text-emerald-50/[0.7]">
              {product.stokMiktari} stok
              <br />
              Ürün ID {product.id}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="border-white/[0.2] bg-white/[0.08] text-white hover:bg-white/[0.14]"
              onClick={() => onFavorite(product)}
              disabled={actionStatus === `favorite-${product.id}`}
            >
              {actionStatus === `favorite-${product.id}` ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Heart className={cn(isFavorite && "fill-current")} aria-hidden />
              )}
              {isFavorite ? "Çıkar" : "Favori"}
            </Button>
            <Button
              variant="outline"
              className="border-white/[0.2] bg-white/[0.08] text-white hover:bg-white/[0.14]"
              onClick={() => onOpenChat(product.saticiId)}
            >
              <MessageCircle aria-hidden />
              Mesaj
            </Button>
          </div>
        </div>

        <form
          className="rounded-lg border border-border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onDemand(product.id, miktar, note);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">Talep aç</h3>
              <p className="text-sm text-muted-foreground">
                Anlaşma akışı ödeme/sipariş değil, satıcıyla mutabakat içindir.
              </p>
            </div>
            <Truck className="size-5 text-primary" aria-hidden />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[110px_1fr]">
            <Input
              type="number"
              min={1}
              max={100000}
              value={miktar}
              onChange={(event) => setMiktar(Number(event.target.value))}
            />
            <Input value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <Button
            className="mt-3 w-full"
            variant="premium"
            disabled={actionStatus === `demand-${product.id}`}
          >
            {actionStatus === `demand-${product.id}` ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Send aria-hidden />
            )}
            Talep gönder
          </Button>
        </form>

        <form
          className="rounded-lg border border-border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onRate(product.id, rating);
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto] sm:items-end">
            <Field label="Puan ver" htmlFor="rating">
              <select
                id="rating"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} yıldız
                  </option>
                ))}
              </select>
            </Field>
            <Button disabled={actionStatus === `rating-${product.id}`}>
              <Star aria-hidden />
              Kaydet
            </Button>
          </div>
        </form>

        <form
          className="rounded-lg border border-border bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (comment.trim().length >= 3) {
              onComment(product.id, comment.trim());
              setComment("");
            }
          }}
        >
          <Field label="Yorum yaz" htmlFor="comment">
            <Input
              id="comment"
              value={comment}
              minLength={3}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Ürün çok taze geldi."
            />
          </Field>
          <Button
            className="mt-3 w-full"
            variant="outline"
            disabled={actionStatus === `comment-${product.id}`}
          >
            <MessageCircle aria-hidden />
            Yorum ekle
          </Button>
        </form>

        <div className="rounded-lg border border-border bg-white">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-bold">Yorumlar</h3>
          </div>
          <div className="divide-y divide-border">
            {product.yorumlar.length > 0 ? (
              product.yorumlar.slice(0, 4).map((commentItem) => (
                <div key={commentItem.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm leading-6">{commentItem.icerik}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {commentItem.kullaniciAdi ?? "Yöremio kullanıcısı"} ·{" "}
                        {formatShortDate(commentItem.tarih)}
                      </p>
                    </div>
                    {authUser?.userId === commentItem.kullaniciId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Yorumu sil"
                        onClick={() => onDeleteComment(commentItem.id, product.id)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-5 text-sm text-muted-foreground">
                Bu ürün için henüz yorum yok.
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceSection({
  workspace,
  setWorkspace,
  authUser,
  selectedProduct,
  categories,
  recommendedProducts,
  favoriteProducts,
  buyerDemands,
  sellerProfile,
  sellerProducts,
  sellerDemands,
  totalOpenSellerDemands,
  conversations,
  chatMessages,
  chatTargetId,
  chatState,
  signalRState,
  actionStatus,
  onLogin,
  onSelectProduct,
  onDemand,
  onAcceptOffer,
  onProfileUpdate,
  onProductSave,
  onProductDelete,
  onDeleteMedia,
  onOffer,
  onCategorySave,
  onCategoryDelete,
  onChatTargetChange,
  onSendMessage,
}: {
  workspace: Workspace;
  setWorkspace: (value: Workspace) => void;
  authUser: AuthState | null;
  selectedProduct: ProductDto | null;
  categories: CategoryDto[];
  recommendedProducts: ProductDto[];
  favoriteProducts: ProductDto[];
  buyerDemands: DemandDto[];
  sellerProfile: SellerProfileDto | null;
  sellerProducts: ProductDto[];
  sellerDemands: DemandDto[];
  totalOpenSellerDemands: number;
  conversations: ChatConversationDto[];
  chatMessages: ChatMessageDto[];
  chatTargetId: string;
  chatState: LoadState;
  signalRState: string;
  actionStatus: string | null;
  onLogin: () => void;
  onSelectProduct: (id: number) => void;
  onDemand: (urunId: number, miktar: number, note?: string) => void;
  onAcceptOffer: (offerId: number) => void;
  onProfileUpdate: (values: {
    magazaAdi: string;
    adres: string;
    sehir: string;
    ilce: string;
    phoneNumber: string;
  }) => void;
  onProductSave: (values: ProductFormValues, productId?: number) => void;
  onProductDelete: (urunId: number) => void;
  onDeleteMedia: (urunId: number, mediaId: number, kind: "image" | "video") => void;
  onOffer: (
    talepId: number,
    values: { birimFiyat?: number; mesaj: string },
  ) => void;
  onCategorySave: (
    values: { adi: string; aciklama: string },
    categoryToUpdate?: number,
  ) => void;
  onCategoryDelete: (id: number) => void;
  onChatTargetChange: (value: string) => void;
  onSendMessage: (receiverId: string, message: string) => void;
}) {
  return (
    <div className="mx-auto max-w-[1680px] px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="plum">
            <Sparkles className="size-3.5" aria-hidden />
            Genel panel
          </Badge>
          <h2 className="mt-3 text-3xl font-black tracking-normal text-brand-brown">
            Pazar operasyon merkezi
          </h2>
        </div>
        <div className="flex w-full rounded-lg border border-border bg-muted p-1 sm:w-auto">
          {workspaces.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setWorkspace(item.id)}
                className={cn(
                  "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition sm:flex-none",
                  workspace === item.id
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {workspace === "buyer" ? (
          <BuyerWorkspace
            authUser={authUser}
            selectedProduct={selectedProduct}
            recommendedProducts={recommendedProducts}
            favoriteProducts={favoriteProducts}
            demands={buyerDemands}
            actionStatus={actionStatus}
            onLogin={onLogin}
            onSelectProduct={onSelectProduct}
            onDemand={onDemand}
            onAcceptOffer={onAcceptOffer}
          />
        ) : null}
        {workspace === "seller" ? (
          <SellerWorkspace
            authUser={authUser}
            categories={categories}
            profile={sellerProfile}
            products={sellerProducts}
            demands={sellerDemands}
            totalOpenDemands={totalOpenSellerDemands}
            actionStatus={actionStatus}
            onLogin={onLogin}
            onSelectProduct={onSelectProduct}
            onProfileUpdate={onProfileUpdate}
            onProductSave={onProductSave}
            onProductDelete={onProductDelete}
            onDeleteMedia={onDeleteMedia}
            onOffer={onOffer}
            onCategorySave={onCategorySave}
            onCategoryDelete={onCategoryDelete}
          />
        ) : null}
        {workspace === "chat" ? (
          <ChatWorkspace
            authUser={authUser}
            selectedProduct={selectedProduct}
            conversations={conversations}
            messages={chatMessages}
            targetId={chatTargetId}
            chatState={chatState}
            signalRState={signalRState}
            actionStatus={actionStatus}
            onLogin={onLogin}
            onTargetChange={onChatTargetChange}
            onSendMessage={onSendMessage}
          />
        ) : null}
      </div>
    </div>
  );
}

function BuyerWorkspace({
  authUser,
  selectedProduct,
  recommendedProducts,
  favoriteProducts,
  demands,
  actionStatus,
  onLogin,
  onSelectProduct,
  onDemand,
  onAcceptOffer,
}: {
  authUser: AuthState | null;
  selectedProduct: ProductDto | null;
  recommendedProducts: ProductDto[];
  favoriteProducts: ProductDto[];
  demands: DemandDto[];
  actionStatus: string | null;
  onLogin: () => void;
  onSelectProduct: (id: number) => void;
  onDemand: (urunId: number, miktar: number, note?: string) => void;
  onAcceptOffer: (offerId: number) => void;
}) {
  const [miktar, setMiktar] = useState(2);
  const [note, setNote] = useState("Toplu alım için fiyat rica ederim.");

  if (!authUser || authUser.role !== "ALICI") {
    return <LockedPanel role="ALICI" onLogin={onLogin} />;
  }

  const openDemands = demands.filter((demand) => demand.durum === "ACIK").length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <WorkspaceStat
            icon={Sparkles}
            label="Önerilen"
            value={String(recommendedProducts.length)}
          />
          <WorkspaceStat icon={Heart} label="Favori" value={String(favoriteProducts.length)} />
          <WorkspaceStat icon={PackagePlus} label="Açık talep" value={String(openDemands)} />
        </div>

        <Panel title="Taleplerim" description="Teklifler ve anlaşma durumları">
          {demands.length > 0 ? (
            <div className="divide-y divide-border">
              {demands.map((demand) => (
                <div key={demand.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectProduct(demand.urunId)}
                        className="text-left font-semibold transition hover:text-primary"
                      >
                        {demand.urunAdi}
                      </button>
                      <p className="text-sm text-muted-foreground">
                        {demand.miktar} adet · {formatShortDate(demand.olusturmaTarihi)}
                      </p>
                      {demand.not ? (
                        <p className="mt-2 text-sm leading-6">{demand.not}</p>
                      ) : null}
                    </div>
                    <Badge variant={demand.durum === "ACIK" ? "green" : "plum"}>
                      {demand.durum}
                    </Badge>
                  </div>
                  {demand.teklifler.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {demand.teklifler.map((offer) => (
                        <div
                          key={offer.id}
                          className="grid gap-2 rounded-md border border-border bg-background p-3 md:grid-cols-[1fr_140px_auto] md:items-center"
                        >
                          <div>
                            <p className="font-semibold">
                              {offer.saticiMagazaAdi ?? "Satıcı"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {offer.mesaj}
                            </p>
                          </div>
                          <p className="font-black text-primary">
                            {offer.birimFiyat ? formatPrice(offer.birimFiyat) : "Fiyat yok"}
                          </p>
                          <Button
                            size="sm"
                            variant={offer.durum === "KABUL" ? "default" : "outline"}
                            disabled={
                              demand.durum !== "ACIK" ||
                              offer.durum === "KABUL" ||
                              actionStatus === `accept-${offer.id}`
                            }
                            onClick={() => onAcceptOffer(offer.id)}
                          >
                            <Check aria-hidden />
                            {offer.durum === "KABUL" ? "Kabul" : "Kabul et"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              title="Henüz talep yok."
              description="Ürün detayından veya hızlı talep formundan satıcıya talep gönderebilirsin."
            />
          )}
        </Panel>

        <ProductStrip
          title="Önerilen ürünler"
          products={recommendedProducts}
          onSelectProduct={onSelectProduct}
        />
        <ProductStrip
          title="Favorilerim"
          products={favoriteProducts}
          onSelectProduct={onSelectProduct}
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Hızlı talep</h3>
            <p className="text-sm text-muted-foreground">
              Seçili ürün için satıcıya net bir istek gönder
            </p>
          </div>
          <Truck className="size-5 text-primary" aria-hidden />
        </div>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedProduct) return;
            onDemand(selectedProduct.id, miktar, note);
          }}
        >
          <Input
            value={
              selectedProduct
                ? `${selectedProduct.id} · ${selectedProduct.adi}`
                : "Ürün seçilmedi"
            }
            readOnly
          />
          <Input
            type="number"
            min={1}
            value={miktar}
            onChange={(event) => setMiktar(Number(event.target.value))}
          />
          <Input value={note} onChange={(event) => setNote(event.target.value)} />
          <Button
            className="w-full"
            disabled={
              !selectedProduct ||
              actionStatus === `demand-${selectedProduct.id}`
            }
          >
            <Send aria-hidden />
            Gönder
          </Button>
        </form>
      </Card>
    </div>
  );
}

function SellerWorkspace({
  authUser,
  categories,
  profile,
  products,
  demands,
  totalOpenDemands,
  actionStatus,
  onLogin,
  onSelectProduct,
  onProfileUpdate,
  onProductSave,
  onProductDelete,
  onDeleteMedia,
  onOffer,
  onCategorySave,
  onCategoryDelete,
}: {
  authUser: AuthState | null;
  categories: CategoryDto[];
  profile: SellerProfileDto | null;
  products: ProductDto[];
  demands: DemandDto[];
  totalOpenDemands: number;
  actionStatus: string | null;
  onLogin: () => void;
  onSelectProduct: (id: number) => void;
  onProfileUpdate: (values: {
    magazaAdi: string;
    adres: string;
    sehir: string;
    ilce: string;
    phoneNumber: string;
  }) => void;
  onProductSave: (values: ProductFormValues, productId?: number) => void;
  onProductDelete: (urunId: number) => void;
  onDeleteMedia: (urunId: number, mediaId: number, kind: "image" | "video") => void;
  onOffer: (
    talepId: number,
    values: { birimFiyat?: number; mesaj: string },
  ) => void;
  onCategorySave: (
    values: { adi: string; aciklama: string },
    categoryToUpdate?: number,
  ) => void;
  onCategoryDelete: (id: number) => void;
}) {
  if (!authUser || authUser.role !== "SATICI") {
    return <LockedPanel role="SATICI" onLogin={onLogin} />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <SellerProfileForm
          profile={profile}
          actionStatus={actionStatus}
          onProfileUpdate={onProfileUpdate}
        />
        <CategoryManager
          categories={categories}
          actionStatus={actionStatus}
          onCategorySave={onCategorySave}
          onCategoryDelete={onCategoryDelete}
        />
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <WorkspaceStat icon={Store} label="Ürünlerim" value={String(products.length)} />
          <WorkspaceStat icon={Users} label="Gelen talep" value={String(demands.length)} />
          <WorkspaceStat icon={ImagePlus} label="Açık talep" value={String(totalOpenDemands)} />
        </div>

        <ProductManager
          categories={categories}
          products={products}
          actionStatus={actionStatus}
          onSelectProduct={onSelectProduct}
          onProductSave={onProductSave}
          onProductDelete={onProductDelete}
          onDeleteMedia={onDeleteMedia}
        />

        <Panel title="Gelen talepler" description="Açık taleplere teklif ver">
          {demands.length > 0 ? (
            <div className="grid gap-3 p-4">
              {demands.map((demand) => (
                <SellerDemandCard
                  key={demand.id}
                  demand={demand}
                  actionStatus={actionStatus}
                  onOffer={onOffer}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Inbox}
              title="Gelen talep yok."
              description="Ürünlerin için talep geldiğinde burada teklif verebilirsin."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function SellerProfileForm({
  profile,
  actionStatus,
  onProfileUpdate,
}: {
  profile: SellerProfileDto | null;
  actionStatus: string | null;
  onProfileUpdate: (values: {
    magazaAdi: string;
    adres: string;
    sehir: string;
    ilce: string;
    phoneNumber: string;
  }) => void;
}) {
  const [magazaAdi, setMagazaAdi] = useState(profile?.magazaAdi ?? "");
  const [adres, setAdres] = useState(profile?.adres ?? "");
  const [sehir, setSehir] = useState(profile?.sehir ?? "");
  const [ilce, setIlce] = useState(profile?.ilce ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? "");

  useEffect(() => {
    setMagazaAdi(profile?.magazaAdi ?? "");
    setAdres(profile?.adres ?? "");
    setSehir(profile?.sehir ?? "");
    setIlce(profile?.ilce ?? "");
    setPhoneNumber(profile?.phoneNumber ?? "");
  }, [profile]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Satıcı profili</h3>
          <p className="text-sm text-muted-foreground">
            Mağaza bilgileri ve doğrulama
          </p>
        </div>
        <ShieldCheck className="size-5 text-primary" aria-hidden />
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onProfileUpdate({ magazaAdi, adres, sehir, ilce, phoneNumber });
        }}
      >
        <Input
          placeholder="Mağaza adı"
          value={magazaAdi}
          onChange={(event) => setMagazaAdi(event.target.value)}
        />
        <Input
          placeholder="Adres"
          value={adres}
          onChange={(event) => setAdres(event.target.value)}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Şehir"
            value={sehir}
            onChange={(event) => setSehir(event.target.value)}
          />
          <Input
            placeholder="İlçe"
            value={ilce}
            onChange={(event) => setIlce(event.target.value)}
          />
        </div>
        <Input
          placeholder="Telefon"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
        <Button
          className="w-full"
          variant="premium"
          disabled={actionStatus === "profile"}
        >
          {actionStatus === "profile" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
          Profili güncelle
        </Button>
      </form>
    </Card>
  );
}

function ProductManager({
  categories,
  products,
  actionStatus,
  onSelectProduct,
  onProductSave,
  onProductDelete,
  onDeleteMedia,
}: {
  categories: CategoryDto[];
  products: ProductDto[];
  actionStatus: string | null;
  onSelectProduct: (id: number) => void;
  onProductSave: (values: ProductFormValues, productId?: number) => void;
  onProductDelete: (urunId: number) => void;
  onDeleteMedia: (urunId: number, mediaId: number, kind: "image" | "video") => void;
}) {
  const [editingProductId, setEditingProductId] = useState<number | undefined>();
  const editingProduct = products.find((product) => product.id === editingProductId);

  return (
    <Panel title="Ürün yönetimi" description="Ürün ekle, güncelle, medya yönet">
      <ProductForm
        categories={categories}
        product={editingProduct}
        actionStatus={actionStatus}
        onCancel={() => setEditingProductId(undefined)}
        onProductSave={(values, productId) => {
          onProductSave(values, productId);
          setEditingProductId(undefined);
        }}
      />

      <div className="grid gap-3 border-t border-border p-4">
        {products.length > 0 ? (
          products.map((product) => (
            <div
              key={product.id}
              className="grid gap-3 rounded-lg border border-border bg-background p-3 lg:grid-cols-[96px_1fr_auto] lg:items-start"
            >
              <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                <Image
                  src={productImage(product)}
                  alt={product.adi}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectProduct(product.id)}
                  className="text-left font-bold transition hover:text-primary"
                >
                  {product.adi}
                </button>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatPrice(product.fiyat)} · {product.stokMiktari} stok ·{" "}
                  {product.resimler.length} resim · {product.videolar.length} video
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.resimler.map((image) => (
                    <Button
                      key={image.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onDeleteMedia(product.id, image.id, "image")}
                      disabled={actionStatus === `media-${image.id}`}
                    >
                      <ImagePlus aria-hidden />
                      Resim {image.id}
                    </Button>
                  ))}
                  {product.videolar.map((video) => (
                    <Button
                      key={video.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onDeleteMedia(product.id, video.id, "video")}
                      disabled={actionStatus === `media-${video.id}`}
                    >
                      <Video aria-hidden />
                      Video {video.id}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 lg:flex-col">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingProductId(product.id)}
                >
                  <Edit3 aria-hidden />
                  Düzenle
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onProductDelete(product.id)}
                  disabled={actionStatus === `delete-product-${product.id}`}
                >
                  <Trash2 aria-hidden />
                  Sil
                </Button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={PackagePlus}
            title="Ürün yok."
            description="İlk ürününü ekleyerek satıcı vitrinini oluştur."
          />
        )}
      </div>
    </Panel>
  );
}

function ProductForm({
  categories,
  product,
  actionStatus,
  onCancel,
  onProductSave,
}: {
  categories: CategoryDto[];
  product?: ProductDto;
  actionStatus: string | null;
  onCancel: () => void;
  onProductSave: (values: ProductFormValues, productId?: number) => void;
}) {
  const [adi, setAdi] = useState(product?.adi ?? "");
  const [aciklama, setAciklama] = useState(product?.aciklama ?? "");
  const [fiyat, setFiyat] = useState(product?.fiyat ?? 100);
  const [stokMiktari, setStokMiktari] = useState(product?.stokMiktari ?? 10);
  const [kategoriId, setKategoriId] = useState(
    product?.kategoriId ?? categories[0]?.id ?? 1,
  );
  const [resimler, setResimler] = useState<File[]>([]);
  const [videolar, setVideolar] = useState<File[]>([]);

  useEffect(() => {
    setAdi(product?.adi ?? "");
    setAciklama(product?.aciklama ?? "");
    setFiyat(product?.fiyat ?? 100);
    setStokMiktari(product?.stokMiktari ?? 10);
    setKategoriId(product?.kategoriId ?? categories[0]?.id ?? 1);
    setResimler([]);
    setVideolar([]);
  }, [categories, product]);

  const updateImages = (event: ChangeEvent<HTMLInputElement>) => {
    setResimler(Array.from(event.target.files ?? []));
  };

  const updateVideos = (event: ChangeEvent<HTMLInputElement>) => {
    setVideolar(Array.from(event.target.files ?? []));
  };

  return (
    <form
      className="grid gap-3 p-4 lg:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onProductSave(
          {
            adi,
            aciklama,
            fiyat,
            stokMiktari,
            kategoriId,
            resimler,
            videolar,
          },
          product?.id,
        );
      }}
    >
      <Field label="Ürün adı" htmlFor="product-name">
        <Input
          id="product-name"
          value={adi}
          minLength={3}
          onChange={(event) => setAdi(event.target.value)}
          required={!product}
        />
      </Field>
      <Field label="Kategori" htmlFor="product-category">
        <select
          id="product-category"
          value={kategoriId}
          onChange={(event) => setKategoriId(Number(event.target.value))}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.adi}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fiyat" htmlFor="product-price">
        <Input
          id="product-price"
          type="number"
          min={0.01}
          step={0.01}
          value={fiyat}
          onChange={(event) => setFiyat(Number(event.target.value))}
        />
      </Field>
      <Field label="Stok" htmlFor="product-stock">
        <Input
          id="product-stock"
          type="number"
          min={0}
          value={stokMiktari}
          onChange={(event) => setStokMiktari(Number(event.target.value))}
        />
      </Field>
      <Field label="Açıklama" htmlFor="product-description">
        <Input
          id="product-description"
          value={aciklama}
          onChange={(event) => setAciklama(event.target.value)}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Resimler" htmlFor="product-images">
          <Input
            id="product-images"
            type="file"
            accept="image/*"
            multiple
            onChange={updateImages}
          />
        </Field>
        <Field label="Videolar" htmlFor="product-videos">
          <Input
            id="product-videos"
            type="file"
            accept="video/*"
            multiple
            onChange={updateVideos}
          />
        </Field>
      </div>
      <div className="flex gap-2 lg:col-span-2">
        {product ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            <X aria-hidden />
            İptal
          </Button>
        ) : null}
        <Button
          className="flex-1"
          variant="premium"
          disabled={actionStatus === "product-form"}
        >
          {actionStatus === "product-form" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <UploadCloud aria-hidden />
          )}
          {product ? "Ürünü güncelle" : "Ürün ekle"}
        </Button>
      </div>
    </form>
  );
}

function CategoryManager({
  categories,
  actionStatus,
  onCategorySave,
  onCategoryDelete,
}: {
  categories: CategoryDto[];
  actionStatus: string | null;
  onCategorySave: (
    values: { adi: string; aciklama: string },
    categoryToUpdate?: number,
  ) => void;
  onCategoryDelete: (id: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | "new">("new");
  const selectedCategory =
    selectedId === "new"
      ? undefined
      : categories.find((category) => category.id === selectedId);
  const [adi, setAdi] = useState("");
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    setAdi(selectedCategory?.adi ?? "");
    setAciklama(selectedCategory?.aciklama ?? "");
  }, [selectedCategory]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Kategori yönetimi</h3>
          <p className="text-sm text-muted-foreground">
            Kategori oluştur, güncelle veya sil
          </p>
        </div>
        <Leaf className="size-5 text-primary" aria-hidden />
      </div>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onCategorySave(
            { adi, aciklama },
            selectedId === "new" ? undefined : selectedId,
          );
        }}
      >
        <select
          value={selectedId}
          onChange={(event) =>
            setSelectedId(event.target.value === "new" ? "new" : Number(event.target.value))
          }
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        >
          <option value="new">Yeni kategori</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.adi}
            </option>
          ))}
        </select>
        <Input
          placeholder="Kategori adı"
          value={adi}
          onChange={(event) => setAdi(event.target.value)}
          minLength={2}
          required
        />
        <Input
          placeholder="Açıklama"
          value={aciklama}
          onChange={(event) => setAciklama(event.target.value)}
        />
        <div className="flex gap-2">
          <Button className="flex-1" disabled={actionStatus === "category"}>
            <Check aria-hidden />
            {selectedId === "new" ? "Oluştur" : "Güncelle"}
          </Button>
          {selectedId !== "new" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCategoryDelete(selectedId)}
              disabled={actionStatus === "category"}
            >
              <Trash2 aria-hidden />
              Sil
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function SellerDemandCard({
  demand,
  actionStatus,
  onOffer,
}: {
  demand: DemandDto;
  actionStatus: string | null;
  onOffer: (
    talepId: number,
    values: { birimFiyat?: number; mesaj: string },
  ) => void;
}) {
  const existingOffer = demand.teklifler[0];
  const [birimFiyat, setBirimFiyat] = useState(existingOffer?.birimFiyat ?? 100);
  const [mesaj, setMesaj] = useState(
    existingOffer?.mesaj ?? "Toplu alım için özel fiyat uygulayabilirim.",
  );

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold">{demand.urunAdi}</p>
          <p className="text-sm text-muted-foreground">
            {demand.miktar} adet · {formatShortDate(demand.olusturmaTarihi)}
          </p>
          {demand.not ? <p className="mt-2 text-sm leading-6">{demand.not}</p> : null}
        </div>
        <Badge variant={demand.durum === "ACIK" ? "green" : "plum"}>
          {demand.durum}
        </Badge>
      </div>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          onOffer(demand.id, { birimFiyat, mesaj });
        }}
      >
        <Input
          type="number"
          min={0.01}
          step={0.01}
          value={birimFiyat}
          onChange={(event) => setBirimFiyat(Number(event.target.value))}
        />
        <Input value={mesaj} onChange={(event) => setMesaj(event.target.value)} />
        <Button
          variant="premium"
          disabled={demand.durum !== "ACIK" || actionStatus === `offer-${demand.id}`}
        >
          <CircleDollarSign aria-hidden />
          Teklif ver
        </Button>
      </form>
    </div>
  );
}

function ChatWorkspace({
  authUser,
  selectedProduct,
  conversations,
  messages,
  targetId,
  chatState,
  signalRState,
  actionStatus,
  onLogin,
  onTargetChange,
  onSendMessage,
}: {
  authUser: AuthState | null;
  selectedProduct: ProductDto | null;
  conversations: ChatConversationDto[];
  messages: ChatMessageDto[];
  targetId: string;
  chatState: LoadState;
  signalRState: string;
  actionStatus: string | null;
  onLogin: () => void;
  onTargetChange: (value: string) => void;
  onSendMessage: (receiverId: string, message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const currentTarget = targetId || selectedProduct?.saticiId || "";
  const selectedConversation = conversations.find(
    (conversation) => conversation.userId === currentTarget,
  );
  const currentName = selectedConversation
    ? conversationName(selectedConversation)
    : selectedProduct
      ? sellerName(selectedProduct)
      : "Görüşme seçilmedi";

  if (!authUser) {
    return <LockedPanel role="ALICI" onLogin={onLogin} anyRole />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between px-1 py-2">
          <h3 className="font-bold">Konuşmalar</h3>
          <Badge variant={signalRState === "Canlı" ? "green" : "outline"}>
            {signalRState}
          </Badge>
        </div>

        <div className="mt-2 space-y-2">
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <button
                key={conversation.userId}
                type="button"
                onClick={() => onTargetChange(conversation.userId)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition",
                  currentTarget === conversation.userId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white hover:bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold">
                    {conversationName(conversation)}
                  </p>
                  {conversation.unreadCount > 0 ? (
                    <span className="grid size-6 place-items-center rounded-full bg-accent text-xs font-black text-accent-foreground">
                      {conversation.unreadCount}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-1 text-sm opacity-80">
                  {conversation.lastMessage ?? "Henüz mesaj yok"}
                </p>
                {conversation.lastMessageAt ? (
                  <p className="mt-2 flex items-center gap-1 text-xs opacity-70">
                    <Clock3 className="size-3.5" aria-hidden />
                    {formatShortDate(conversation.lastMessageAt)}
                  </p>
                ) : null}
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Konuşma yok. Ürün satıcısına mesaj gönderebilirsin.
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-bold">
              {currentName}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {currentTarget ? "Güvenli mesajlaşma açık" : "Bir ürün detayından mesaj başlat"}
            </p>
          </div>
          <Badge variant="green">{signalRState}</Badge>
        </div>

        <div className="grid min-h-80 content-end gap-3 bg-[linear-gradient(180deg,#f7f9f4,#fffefa)] p-4">
          {chatState === "loading" ? (
            <div className="grid place-items-center py-10 text-sm font-semibold text-muted-foreground">
              <Loader2 className="mb-2 size-5 animate-spin" aria-hidden />
              Mesajlar yükleniyor
            </div>
          ) : messages.length > 0 ? (
            messages.map((message) => (
              <ChatBubble key={message.id} mine={message.isMine}>
                <span>{message.message}</span>
                <span className="mt-1 block text-[11px] opacity-70">
                  {formatShortDate(message.sentAt)}
                </span>
              </ChatBubble>
            ))
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Mesaj geçmişi boş."
              description={
                currentTarget
                  ? "Bu görüşme için ilk mesajı yazabilirsin."
                  : "Mesaj başlatmak için ürün detayında Mesaj butonunu kullan."
              }
            />
          )}
        </div>

        <form
          className="grid gap-2 border-t border-border p-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim() || !currentTarget) return;
            onSendMessage(currentTarget, draft.trim());
            setDraft("");
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              currentTarget
                ? `${currentName} için mesaj yaz`
                : "Önce ürün detayından mesaj başlat"
            }
            maxLength={1000}
            disabled={!currentTarget}
          />
          <Button disabled={actionStatus === "chat-send" || !currentTarget}>
            {actionStatus === "chat-send" ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Send aria-hidden />
            )}
            Gönder
          </Button>
        </form>
      </div>
    </div>
  );
}

function ProductStrip({
  title,
  products,
  onSelectProduct,
}: {
  title: string;
  products: ProductDto[];
  onSelectProduct: (id: number) => void;
}) {
  return (
    <Panel title={title} description="Canlı API listesinden">
      {products.length > 0 ? (
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {products.slice(0, 6).map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelectProduct(product.id)}
              className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-border bg-background p-2 text-left transition hover:border-primary/40"
            >
              <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                <Image
                  src={productImage(product)}
                  alt={product.adi}
                  fill
                  sizes="72px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 font-bold">{product.adi}</p>
                <p className="mt-1 text-sm text-primary">{formatPrice(product.fiyat)}</p>
                <p className="text-xs text-muted-foreground">
                  {product.ortalamaPuan.toFixed(1)} puan · {product.toplamYorum} yorum
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Inbox}
          title="Liste boş."
          description="Bu alan giriş yapılan kullanıcının API verisiyle dolar."
        />
      )}
    </Panel>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-white p-3 shadow-sm">
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Önceki
      </Button>
      <p className="text-sm font-semibold text-muted-foreground">
        {page} / {totalPages}
      </p>
      <Button
        variant="outline"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Sonraki
      </Button>
    </div>
  );
}

function LockedPanel({
  role,
  anyRole,
  onLogin,
}: {
  role: UserRole;
  anyRole?: boolean;
  onLogin: () => void;
}) {
  const sellerFeatures = [
    { icon: Store, label: "Satıcı profili" },
    { icon: PackagePlus, label: "Ürün ekle" },
    { icon: Edit3, label: "Ürün güncelle" },
    { icon: ImagePlus, label: "Medya yönetimi" },
    { icon: Users, label: "Gelen talepler" },
    { icon: CircleDollarSign, label: "Teklif ver" },
  ];

  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center">
      <ShieldCheck className="mx-auto size-9 text-primary" aria-hidden />
      <h3 className="mt-3 text-xl font-black text-brand-brown">
        {anyRole ? "Giriş gerekli" : `${roleLabel(role)} girişi gerekli`}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Bu panel gerçek API verilerini kullandığı için JWT oturumu ve doğru rol
        gerekir.
      </p>
      {role === "SATICI" && !anyRole ? (
        <div className="mx-auto mt-5 grid max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sellerFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.label}
                className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-left text-sm font-semibold"
              >
                <Icon className="size-4 text-primary" aria-hidden />
                {feature.label}
              </div>
            );
          })}
        </div>
      ) : null}
      <Button className="mt-4" onClick={onLogin}>
        <UserRound aria-hidden />
        Giriş yap
      </Button>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center">
      <Icon className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function WorkspaceStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <Icon className="size-5 text-primary" aria-hidden />
      <p className="mt-3 text-2xl font-black text-brand-brown">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <Icon className="size-4 text-accent" aria-hidden />
      <p className="mt-2 text-lg font-black text-brand-brown">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TrustDial({ score }: { score: number }) {
  const roundedScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div
      className="grid size-20 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--primary) ${roundedScore * 3.6}deg, #e3e8dd 0)`,
      }}
      aria-label={`Güven skoru ${roundedScore}`}
    >
      <div className="grid size-[62px] place-items-center rounded-full bg-white text-center">
        <span className="text-lg font-black text-primary">{roundedScore}</span>
      </div>
    </div>
  );
}

function ChatBubble({
  mine,
  children,
}: {
  mine?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
          mine
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-white",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-semibold" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toast({
  toast,
  onClose,
}: {
  toast: NonNullable<ToastState>;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-32px))] rounded-lg border border-border bg-white p-4 shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md",
            toast.kind === "success" && "bg-emerald-100 text-emerald-700",
            toast.kind === "error" && "bg-red-100 text-red-700",
            toast.kind === "info" && "bg-sky-100 text-sky-700",
          )}
        >
          {toast.kind === "success" ? (
            <Check className="size-4" aria-hidden />
          ) : toast.kind === "error" ? (
            <AlertTriangle className="size-4" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
        </div>
        <p className="min-w-0 flex-1 text-sm font-semibold leading-6">
          {toast.message}
        </p>
        <Button variant="ghost" size="icon" onClick={onClose} title="Kapat">
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}
